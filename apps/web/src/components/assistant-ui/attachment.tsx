"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FC } from "react";
import {
  AttachmentPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  useAui,
  useAuiState,
} from "@assistant-ui/react";
import { Camera, ImageIcon, Loader2, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useShallow } from "zustand/react/shallow";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MAX_IMAGES_PER_MESSAGE } from "@/lib/chat/limits";
import { cn } from "@/lib/utils";
import { TooltipIconButton } from "./tooltip-icon-button";

function useObjectUrl(file: File | undefined) {
  const [entry, setEntry] = useState<{ file: File; url: string }>();

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setEntry({ file, url });
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return entry && entry.file === file ? entry.url : undefined;
}

function useAttachmentSrc() {
  const { file, src } = useAuiState(
    useShallow((s): { file?: File; src?: string } => {
      if (s.attachment.type !== "image") return {};
      if (s.attachment.file) return { file: s.attachment.file };
      const image = s.attachment.content?.find((part) => part.type === "image");
      return image?.type === "image" ? { src: image.image } : {};
    })
  );
  return useObjectUrl(file) ?? src;
}

const AttachmentTile: FC = () => {
  const t = useTranslations("chat.attachments");
  const aui = useAui();
  const isComposer = aui.attachment.source !== "message";
  const src = useAttachmentSrc();
  const name = useAuiState((s) => s.attachment.name);
  const isBusy = useAuiState(
    (s) =>
      s.attachment.status.type === "running" ||
      (s.optional.message?.submission !== undefined &&
        s.attachment.status.type !== "complete")
  );

  const tile = (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-muted",
        isComposer ? "size-16" : "size-24"
      )}
    >
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="size-full object-cover" />
      )}
      {isBusy && (
        <div
          role="status"
          aria-label={t("uploading")}
          className="absolute inset-0 flex items-center justify-center bg-background/60"
        >
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );

  return (
    <AttachmentPrimitive.Root className="relative shrink-0">
      {src && !isComposer ? (
        <Dialog>
          <DialogTrigger asChild>
            <button type="button" aria-label={t("preview", { name })} className="block">
              {tile}
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl p-2">
            <DialogTitle className="sr-only">{name}</DialogTitle>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={name} className="mx-auto max-h-[80dvh] w-auto rounded-md object-contain" />
          </DialogContent>
        </Dialog>
      ) : (
        tile
      )}
      {isComposer && (
        <AttachmentPrimitive.Remove asChild>
          <button
            type="button"
            aria-label={t("remove", { name })}
            title={t("remove", { name })}
            className="absolute -end-2 -top-2 flex size-8 items-center justify-center rounded-full after:absolute after:inset-0"
          >
            <span className="flex size-5 items-center justify-center rounded-full border bg-background text-foreground shadow-sm">
              <X className="size-3" />
            </span>
          </button>
        </AttachmentPrimitive.Remove>
      )}
    </AttachmentPrimitive.Root>
  );
};

export const UserMessageAttachments: FC = () => (
  <div className="flex flex-wrap justify-end gap-2 empty:hidden">
    <MessagePrimitive.Attachments>{() => <AttachmentTile />}</MessagePrimitive.Attachments>
  </div>
);

export const ComposerAttachments: FC = () => (
  <div className="flex w-full flex-row gap-3 overflow-x-auto px-1 pt-2 empty:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
    <ComposerPrimitive.Attachments>{() => <AttachmentTile />}</ComposerPrimitive.Attachments>
  </div>
);

export const ComposerAddAttachment: FC = () => {
  const t = useTranslations("chat.attachments");
  const aui = useAui();
  const count = useAuiState((s) => s.composer.attachments.length);
  const libraryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const remaining = MAX_IMAGES_PER_MESSAGE - count;

  const addFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).slice(0, Math.max(remaining, 0));
    event.target.value = "";
    for (const file of files) void aui.composer.addAttachment(file);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <TooltipIconButton tooltip={t("add")} disabled={remaining <= 0}>
            <Plus />
          </TooltipIconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top">
          <DropdownMenuItem onSelect={() => libraryRef.current?.click()}>
            <ImageIcon />
            {t("library")}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="hidden pointer-coarse:flex"
            onSelect={() => cameraRef.current?.click()}
          >
            <Camera />
            {t("camera")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={addFiles}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={addFiles}
      />
    </>
  );
};
