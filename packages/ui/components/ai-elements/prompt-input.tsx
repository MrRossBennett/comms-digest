"use client";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@repo/ui/components/input-group";
import { Spinner } from "@repo/ui/components/spinner";
import { cn } from "@repo/ui/lib/utils";
import type { ChatStatus } from "ai";
import { CornerDownLeftIcon, SquareIcon, XIcon } from "lucide-react";
import type { ComponentProps, HTMLAttributes, KeyboardEventHandler } from "react";
import { useCallback, useState } from "react";

type FormSubmitEvent = Parameters<NonNullable<ComponentProps<"form">["onSubmit"]>>[0];

export interface PromptInputMessage {
  text: string;
  files: [];
}

export type PromptInputProps = Omit<ComponentProps<"form">, "onSubmit"> & {
  onSubmit: (message: PromptInputMessage, event: FormSubmitEvent) => void | Promise<void>;
};

export const PromptInput = ({ className, children, onSubmit, ...props }: PromptInputProps) => {
  const handleSubmit = useCallback(
    async (event: FormSubmitEvent) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const message = formData.get("message");
      const text = typeof message === "string" ? message : "";
      await onSubmit({ text, files: [] }, event);
    },
    [onSubmit],
  );

  return (
    <form className={cn("w-full", className)} onSubmit={handleSubmit} {...props}>
      <InputGroup className="overflow-hidden">{children}</InputGroup>
    </form>
  );
};

export type PromptInputBodyProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputBody = ({ className, ...props }: PromptInputBodyProps) => (
  <div className={cn("contents", className)} {...props} />
);

export type PromptInputTextareaProps = ComponentProps<typeof InputGroupTextarea>;

export const PromptInputTextarea = ({
  onKeyDown,
  className,
  placeholder = "What would you like to know?",
  ...props
}: PromptInputTextareaProps) => {
  const [isComposing, setIsComposing] = useState(false);
  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = useCallback(
    (event) => {
      onKeyDown?.(event);
      if (event.defaultPrevented || event.key !== "Enter") return;
      if (isComposing || event.nativeEvent.isComposing || event.shiftKey) return;

      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    },
    [isComposing, onKeyDown],
  );

  return (
    <InputGroupTextarea
      className={cn("field-sizing-content max-h-48 min-h-16", className)}
      name="message"
      onCompositionEnd={() => setIsComposing(false)}
      onCompositionStart={() => setIsComposing(true)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      {...props}
    />
  );
};

export type PromptInputFooterProps = Omit<ComponentProps<typeof InputGroupAddon>, "align">;

export const PromptInputFooter = ({ className, ...props }: PromptInputFooterProps) => (
  <InputGroupAddon
    align="block-end"
    className={cn("justify-between gap-3", className)}
    {...props}
  />
);

export type PromptInputSubmitProps = ComponentProps<typeof InputGroupButton> & {
  status?: ChatStatus;
  onStop?: () => void;
};

export const PromptInputSubmit = ({
  className,
  variant = "default",
  size = "icon-sm",
  status,
  onStop,
  onClick,
  children,
  ...props
}: PromptInputSubmitProps) => {
  const isGenerating = status === "submitted" || status === "streaming";
  let icon = <CornerDownLeftIcon className="size-4" />;

  if (status === "submitted") icon = <Spinner />;
  if (status === "streaming") icon = <SquareIcon className="size-4" />;
  if (status === "error") icon = <XIcon className="size-4" />;

  return (
    <InputGroupButton
      aria-label={isGenerating ? "Stop" : "Submit"}
      className={className}
      onClick={(event) => {
        if (isGenerating && onStop) {
          event.preventDefault();
          onStop();
          return;
        }
        onClick?.(event);
      }}
      size={size}
      type={isGenerating && onStop ? "button" : "submit"}
      variant={variant}
      {...props}
    >
      {children ?? icon}
    </InputGroupButton>
  );
};
