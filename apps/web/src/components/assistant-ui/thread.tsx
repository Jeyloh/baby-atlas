"use client";

import type { FC, ReactNode } from "react";
import {
  ActionBarPrimitive,
  AuiIf,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAuiState,
} from "@assistant-ui/react";
import { ArrowDown, Baby, Check, Copy, Pencil, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { PremiumRequiredError } from "@/lib/chat/chat-model-adapter";
import { UserMessageAttachments } from "./attachment";
import { MarkdownText } from "./markdown-text";
import { TooltipIconButton } from "./tooltip-icon-button";
import { ToolCallRow } from "./tool-call-row";

const SUGGESTION_KEYS = ["sleep", "diaper", "fever", "summary"] as const;

interface ThreadProps {
  footer: ReactNode;
}

export const Thread: FC<ThreadProps> = ({ footer }) => (
  <ThreadPrimitive.Root className="flex h-full min-h-0 flex-col bg-background">
    <div className="relative min-h-0 flex-1">
      <ThreadPrimitive.Viewport
        turnAnchor="bottom"
        className="h-full overflow-y-auto overscroll-contain [scrollbar-color:var(--color-border)_transparent] [scrollbar-width:thin]"
      >
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-5 px-4 py-4">
          <AuiIf condition={(s) => s.thread.messages.length === 0}>
            <Welcome />
          </AuiIf>
          <ThreadPrimitive.Messages>{() => <ThreadMessage />}</ThreadPrimitive.Messages>
        </div>
      </ThreadPrimitive.Viewport>
      <ScrollToBottom />
    </div>
    <div className="shrink-0 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto w-full max-w-3xl">{footer}</div>
    </div>
  </ThreadPrimitive.Root>
);

const ScrollToBottom: FC = () => {
  const t = useTranslations("chat");
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <TooltipIconButton
        tooltip={t("scrollToBottom")}
        variant="outline"
        className="absolute bottom-3 left-1/2 -translate-x-1/2 border bg-background shadow-md disabled:invisible"
      >
        <ArrowDown />
      </TooltipIconButton>
    </ThreadPrimitive.ScrollToBottom>
  );
};

const Welcome: FC = () => {
  const t = useTranslations("chat");
  return (
    <div className="my-auto flex flex-col items-center gap-5 py-8 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-muted text-primary">
        <Baby className="size-7" />
      </div>
      <p className="font-display max-w-xs text-xl font-semibold tracking-tight">
        {t("welcome")}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {SUGGESTION_KEYS.map((key) => (
          <ThreadPrimitive.Suggestion key={key} prompt={t(`suggestions.${key}`)} send asChild>
            <button
              type="button"
              className="min-h-12 rounded-full border bg-card px-4 py-2 text-start text-sm text-foreground transition-colors hover:bg-accent"
            >
              {t(`suggestions.${key}`)}
            </button>
          </ThreadPrimitive.Suggestion>
        ))}
      </div>
    </div>
  );
};

const ThreadMessage: FC = () => {
  const role = useAuiState((s) => s.message.role);
  const isEditing = useAuiState((s) => s.message.composer.isEditing);

  if (isEditing) return <EditComposer />;
  return role === "user" ? <UserMessage /> : <AssistantMessage />;
};

const TypingIndicator: FC = () => {
  const t = useTranslations("chat");
  return (
    <span role="status" aria-label={t("assistantWorking")} className="inline-flex gap-1 py-2">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 animate-pulse rounded-full bg-muted-foreground"
          style={{ animationDelay: `${i * 200}ms` }}
        />
      ))}
    </span>
  );
};

const MessageError: FC = () => {
  const isPremiumError = useAuiState((s) => {
    const status = s.message.status;
    return (
      status?.type === "incomplete" &&
      status.reason === "error" &&
      status.error instanceof PremiumRequiredError
    );
  });
  if (isPremiumError) return null;

  return (
    <MessagePrimitive.Error>
      <ErrorPrimitive.Root
        role="alert"
        className="mt-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
      >
        <ErrorPrimitive.Message className="line-clamp-3" />
      </ErrorPrimitive.Root>
    </MessagePrimitive.Error>
  );
};

const AssistantMessage: FC = () => (
  <MessagePrimitive.Root className="flex flex-col items-start gap-1" data-role="assistant">
    <div className="w-full min-w-0 break-words text-foreground">
      <MessagePrimitive.Parts>
        {({ part }) => {
          switch (part.type) {
            case "text":
              return part.text === "" && part.status?.type === "running" ? (
                <TypingIndicator />
              ) : (
                <MarkdownText />
              );
            case "tool-call":
              return <ToolCallRow {...part} />;
            default:
              return null;
          }
        }}
      </MessagePrimitive.Parts>
      <MessageError />
    </div>
    <AssistantActionBar />
  </MessagePrimitive.Root>
);

const CopyButton: FC = () => {
  const t = useTranslations("chat.actions");
  const copied = useAuiState((s) => s.message.isCopied);
  return (
    <ActionBarPrimitive.Copy asChild>
      <TooltipIconButton tooltip={copied ? t("copied") : t("copy")}>
        {copied ? <Check /> : <Copy />}
      </TooltipIconButton>
    </ActionBarPrimitive.Copy>
  );
};

const AssistantActionBar: FC = () => {
  const t = useTranslations("chat.actions");
  return (
    <ActionBarPrimitive.Root hideWhenRunning autohide="never" className="-ms-2 flex gap-0.5">
      <CopyButton />
      <AuiIf condition={(s) => s.message.isLast}>
        <ActionBarPrimitive.Reload asChild>
          <TooltipIconButton tooltip={t("retry")}>
            <RefreshCw />
          </TooltipIconButton>
        </ActionBarPrimitive.Reload>
      </AuiIf>
    </ActionBarPrimitive.Root>
  );
};

const UserMessage: FC = () => {
  const isLastUserMessage = useAuiState((s) => {
    const messages = s.thread.messages;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.role === "user") return i === s.message.index;
    }
    return false;
  });

  return (
    <MessagePrimitive.Root className="flex flex-col items-end gap-1" data-role="user">
      <UserMessageAttachments />
      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2 text-primary-foreground empty:hidden">
        <MessagePrimitive.Parts>
          {({ part }) =>
            part.type === "text" ? (
              <p className="whitespace-pre-wrap break-words">{part.text}</p>
            ) : null
          }
        </MessagePrimitive.Parts>
      </div>
      {isLastUserMessage && <UserActionBar />}
    </MessagePrimitive.Root>
  );
};

const UserActionBar: FC = () => {
  const t = useTranslations("chat.actions");
  return (
    <ActionBarPrimitive.Root hideWhenRunning autohide="never" className="-me-2 flex gap-0.5">
      <ActionBarPrimitive.Edit asChild>
        <TooltipIconButton tooltip={t("edit")}>
          <Pencil />
        </TooltipIconButton>
      </ActionBarPrimitive.Edit>
    </ActionBarPrimitive.Root>
  );
};

const EditComposer: FC = () => {
  const t = useTranslations("chat.actions");
  return (
    <MessagePrimitive.Root className="flex justify-end">
      <ComposerPrimitive.Root className="flex w-full max-w-[85%] flex-col gap-2 rounded-2xl border bg-card p-2">
        <ComposerPrimitive.Input
          autoFocus
          maxRows={6}
          className="min-h-10 w-full resize-none bg-transparent px-2 py-1 text-base outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        />
        <div className="flex justify-end gap-1">
          <ComposerPrimitive.Cancel asChild>
            <Button variant="ghost" size="sm">
              {t("cancel")}
            </Button>
          </ComposerPrimitive.Cancel>
          <ComposerPrimitive.Send asChild>
            <Button size="sm">{t("update")}</Button>
          </ComposerPrimitive.Send>
        </div>
      </ComposerPrimitive.Root>
    </MessagePrimitive.Root>
  );
};
