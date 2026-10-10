"use client";

import type { FC } from "react";
import { AuiIf, ComposerPrimitive } from "@assistant-ui/react";
import { ArrowUp, Square, SquarePen } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { MAX_TEXT_LENGTH, type ModelId } from "@/lib/chat/limits";
import { ComposerAddAttachment, ComposerAttachments } from "./attachment";
import { ModelPicker } from "./model-picker";
import { TooltipIconButton } from "./tooltip-icon-button";

interface ComposerProps {
  model: ModelId;
  onModelChange: (model: ModelId) => void;
  onNewConversation: () => void;
}

export const Composer: FC<ComposerProps> = ({ model, onModelChange, onNewConversation }) => {
  const t = useTranslations("chat");

  return (
    <ComposerPrimitive.Root className="w-full">
      <ComposerPrimitive.AttachmentDropzone asChild>
        <div className="flex w-full flex-col gap-1 rounded-3xl border bg-card p-2 shadow-sm transition-colors focus-within:border-ring data-[dragging=true]:border-dashed data-[dragging=true]:border-primary data-[dragging=true]:bg-accent">
          <ComposerAttachments />
          <ComposerPrimitive.Input
            placeholder={t("placeholder")}
            aria-label={t("messageInput")}
            enterKeyHint="send"
            rows={1}
            maxRows={6}
            maxLength={MAX_TEXT_LENGTH}
            className="max-h-48 min-h-10 w-full resize-none bg-transparent px-3 py-2 text-base leading-6 outline-none [scrollbar-width:none] placeholder:text-muted-foreground [&::-webkit-scrollbar]:hidden"
          />
          <div className="flex items-center justify-between gap-1">
            <div className="flex min-w-0 items-center gap-0.5">
              <ComposerAddAttachment />
              <AuiIf condition={(s) => !s.composer.canCancel}>
                <ModelPicker value={model} onChange={onModelChange} />
              </AuiIf>
              <AuiIf condition={(s) => s.thread.messages.length > 0 && !s.composer.canCancel}>
                <TooltipIconButton tooltip={t("newConversation")} onClick={onNewConversation}>
                  <SquarePen />
                </TooltipIconButton>
              </AuiIf>
            </div>
            <AuiIf condition={(s) => !s.composer.canCancel}>
              <ComposerPrimitive.Send asChild>
                <Button
                  type="button"
                  size="icon"
                  aria-label={t("send")}
                  title={t("send")}
                  className="size-10 shrink-0 rounded-full md:size-9"
                >
                  <ArrowUp />
                </Button>
              </ComposerPrimitive.Send>
            </AuiIf>
            <AuiIf condition={(s) => s.composer.canCancel}>
              <ComposerPrimitive.Cancel asChild>
                <Button
                  type="button"
                  size="icon"
                  aria-label={t("stop")}
                  title={t("stop")}
                  className="size-10 shrink-0 rounded-full md:size-9"
                >
                  <Square className="fill-current" />
                </Button>
              </ComposerPrimitive.Cancel>
            </AuiIf>
          </div>
        </div>
      </ComposerPrimitive.AttachmentDropzone>
    </ComposerPrimitive.Root>
  );
};
