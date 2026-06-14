import { auth } from "@repo/auth/auth";
import {
  CHAT_REFUSAL,
  latestUserQuestion,
  selectChatEvidence,
  streamGroundedChat,
  type GroundedChatMessage,
  type GroundedChatMetadata,
} from "@repo/intelligence";
import { createFileRoute } from "@tanstack/react-router";
import { createUIMessageStream, createUIMessageStreamResponse, validateUIMessages } from "ai";
import { z } from "zod";

import { listGroundedChatEvidence } from "#/lib/chat.server";

const chatRequestSchema = z.object({
  messages: z.array(z.unknown()).min(1).max(20),
});

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const parsed = chatRequestSchema.safeParse(await request.json());
        if (!parsed.success) {
          return Response.json({ error: "Invalid chat request" }, { status: 400 });
        }

        const messages = await validateUIMessages<GroundedChatMessage>({
          messages: parsed.data.messages,
        });
        const totalTextLength = messages.reduce(
          (messageTotal, message) =>
            messageTotal +
            message.parts.reduce(
              (partTotal, part) => partTotal + (part.type === "text" ? part.text.length : 0),
              0,
            ),
          0,
        );
        const question = latestUserQuestion(messages);
        if (!question || question.length > 2_000 || totalTextLength > 10_000) {
          return Response.json({ error: "Invalid question" }, { status: 400 });
        }

        const availableEvidence = await listGroundedChatEvidence(session.user.id);
        const selectedEvidence = selectChatEvidence(question, availableEvidence);
        const metadata: GroundedChatMetadata = { sources: selectedEvidence };

        if (selectedEvidence.length === 0) {
          return staticChatResponse(messages, CHAT_REFUSAL, metadata);
        }

        if (!process.env.ANTHROPIC_API_KEY) {
          return Response.json({ error: "Chat is not configured" }, { status: 503 });
        }

        const result = await streamGroundedChat({
          messages,
          evidence: selectedEvidence,
          apiKey: process.env.ANTHROPIC_API_KEY,
        });

        return result.toUIMessageStreamResponse<GroundedChatMessage>({
          originalMessages: messages,
          messageMetadata: () => metadata,
        });
      },
    },
  },
});

function staticChatResponse(
  messages: GroundedChatMessage[],
  text: string,
  metadata: GroundedChatMetadata,
) {
  const textId = crypto.randomUUID();
  const stream = createUIMessageStream<GroundedChatMessage>({
    originalMessages: messages,
    execute: ({ writer }) => {
      writer.write({ type: "start", messageMetadata: metadata });
      writer.write({ type: "text-start", id: textId });
      writer.write({ type: "text-delta", id: textId, delta: text });
      writer.write({ type: "text-end", id: textId });
      writer.write({
        type: "finish",
        finishReason: "stop",
        messageMetadata: metadata,
      });
    },
  });

  return createUIMessageStreamResponse({ stream });
}
