import { useChat } from "@ai-sdk/react";
import type { GroundedChatMessage, GroundedChatSource } from "@repo/intelligence";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@repo/ui/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@repo/ui/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@repo/ui/components/ai-elements/prompt-input";
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@repo/ui/components/ai-elements/sources";
import { Suggestion, Suggestions } from "@repo/ui/components/ai-elements/suggestion";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { DefaultChatTransport } from "ai";
import { MessageCircleIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { $getHousehold } from "#/lib/household.functions";

const suggestions = [
  "What do I need to do next?",
  "What is coming up this week?",
  "Are there any payments due?",
];

export const Route = createFileRoute("/_auth/app/chat")({
  loader: async () => {
    const household = await $getHousehold();
    if (!household) throw redirect({ to: "/app/onboarding" });
    return { household };
  },
  component: ChatPage,
});

function ChatPage() {
  const { household } = Route.useLoaderData();
  const [input, setInput] = useState("");
  const transport = useMemo(
    () => new DefaultChatTransport<GroundedChatMessage>({ api: "/api/chat" }),
    [],
  );
  const { messages, sendMessage, status, stop, error } = useChat<GroundedChatMessage>({
    transport,
  });
  const isBusy = status === "submitted" || status === "streaming";

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || isBusy) return;
    setInput("");
    await sendMessage({ text });
  };

  return (
    <main className="mx-auto flex h-[calc(100svh-4rem)] w-full max-w-5xl flex-col px-5 py-6 sm:px-8 sm:py-8">
      <div className="mb-5 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Ask about school</h1>
        <p className="text-sm text-muted-foreground">
          Answers use stored communications for{" "}
          {household.children.map(({ displayName }) => displayName).join(", ")}.
        </p>
      </div>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border bg-background">
        <Conversation>
          <ConversationContent className="mx-auto w-full max-w-3xl px-5 py-6 sm:px-8">
            {messages.length === 0 ? (
              <ConversationEmptyState
                icon={<MessageCircleIcon className="size-6" />}
                title="Ask about your school communications"
                description="I’ll answer from stored, cited information and say when it isn’t there."
              >
                <div className="w-full min-w-0 space-y-5 overflow-hidden">
                  <div className="mx-auto w-fit rounded-full bg-muted p-3 text-muted-foreground">
                    <MessageCircleIcon className="size-6" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="font-medium">Ask about your school communications</h2>
                    <p className="text-sm text-muted-foreground">
                      I’ll answer from stored, cited information and say when it isn’t there.
                    </p>
                  </div>
                  <Suggestions className="w-full flex-wrap justify-center px-1 whitespace-normal">
                    {suggestions.map((suggestion) => (
                      <Suggestion key={suggestion} suggestion={suggestion} onClick={ask} />
                    ))}
                  </Suggestions>
                </div>
              </ConversationEmptyState>
            ) : (
              messages.map((message) => (
                <Message from={message.role} key={message.id}>
                  <MessageContent>
                    {message.parts.map((part, index) =>
                      part.type === "text" ? (
                        <MessageResponse key={`${message.id}-${index}`}>
                          {part.text}
                        </MessageResponse>
                      ) : null,
                    )}
                  </MessageContent>
                  {message.role === "assistant" && message.metadata?.sources.length ? (
                    <ChatSources sources={message.metadata.sources} />
                  ) : null}
                </Message>
              ))
            )}
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                Chat could not answer that question. Please try again.
              </p>
            ) : null}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="border-t p-3 sm:p-4">
          <div className="mx-auto max-w-3xl">
            <PromptInput
              onSubmit={async ({ text }) => {
                await ask(text);
              }}
            >
              <PromptInputBody>
                <PromptInputTextarea
                  aria-label="Ask about your school communications"
                  disabled={isBusy}
                  onChange={(event) => setInput(event.currentTarget.value)}
                  placeholder="Ask about dates, payments, activities..."
                  value={input}
                />
              </PromptInputBody>
              <PromptInputFooter>
                <p className="text-xs text-muted-foreground">
                  Comms Digest can make mistakes. Check the cited passages.
                </p>
                <PromptInputSubmit
                  disabled={!input.trim() && !isBusy}
                  onStop={stop}
                  status={status}
                />
              </PromptInputFooter>
            </PromptInput>
          </div>
        </div>
      </section>
    </main>
  );
}

function ChatSources({ sources }: { sources: GroundedChatSource[] }) {
  return (
    <Sources>
      <SourcesTrigger count={sources.length}>Evidence checked ({sources.length})</SourcesTrigger>
      <SourcesContent className="w-full max-w-2xl gap-3">
        {sources.map((source, index) => (
          <Source
            key={source.id}
            title={source.subject}
            className="items-start rounded-xl border p-3 text-foreground"
          >
            <span className="font-medium text-muted-foreground">[{index + 1}]</span>
            <span className="space-y-1">
              <span className="block font-medium">{source.subject ?? source.senderAddress}</span>
              <span className="block leading-5 text-muted-foreground">“{source.citation}”</span>
            </span>
          </Source>
        ))}
      </SourcesContent>
    </Sources>
  );
}
