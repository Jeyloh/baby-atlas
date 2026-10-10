"use client";

import { useLayoutEffect, useRef, useState, type ClipboardEvent } from "react";
import { useTranslations } from "next-intl";
import { Camera, Check, ImagePlus, LoaderCircle, RotateCcw, X } from "lucide-react";
import {
  JOURNAL_TAGS,
  MAX_JOURNAL_PHOTOS,
  MAX_JOURNAL_TEXT_LENGTH,
  type JournalTagValue,
} from "@baby-atlas/schemas";
import { trpc } from "@/lib/trpc/provider";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fromDateInputValue, toDateInputValue, todayInputValue } from "@/components/toddler/date-input";
import { useErrorToast } from "@/components/toddler/use-error-toast";
import { cn } from "@/lib/utils";
import type { UploadErrorCode } from "@/lib/journal/upload-photo";
import { photoUrl, type JournalListItem, type JournalPhotoItem } from "./journal-utils";
import { TagToggles } from "./tag-chips";
import { usePhotoQueue, type QueuedPhoto } from "./use-photo-queue";

interface EntrySheetProps {
  childId: string;
  /** Set to edit an existing entry. */
  entry?: JournalListItem;
  onClose: () => void;
}

/** Create and edit share this bottom sheet. Mount it only while it is open. */
export function EntrySheet({ childId, entry, onClose }: EntrySheetProps) {
  const t = useTranslations("journal");
  const tc = useTranslations("common");
  const { toast } = useToast();
  const onError = useErrorToast(t("errors.title"));
  const utils = trpc.useUtils();

  const [text, setText] = useState(entry?.text ?? "");
  const [date, setDate] = useState(entry ? toDateInputValue(entry.date) : todayInputValue());
  const [tags, setTags] = useState<ReadonlySet<JournalTagValue>>(new Set(entry?.tags ?? []));
  const [entryId, setEntryId] = useState(entry?.id);
  const [existing, setExisting] = useState<JournalPhotoItem[]>(entry?.photos ?? []);
  const [pendingRemoval, setPendingRemoval] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const queue = usePhotoQueue();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const create = trpc.journal.create.useMutation();
  const update = trpc.journal.update.useMutation();
  const deletePhoto = trpc.journal.deletePhoto.useMutation();

  useLayoutEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, [text]);

  const visibleExisting = existing.filter((photo) => !pendingRemoval.has(photo.id));
  const photoCount = visibleExisting.length + queue.items.length;
  const room = MAX_JOURNAL_PHOTOS - photoCount;
  const canSave = text.trim().length > 0 && tags.size > 0 && date.length > 0 && !busy;

  const addFiles = (files: FileList | File[] | null) => {
    if (files) queue.add(Array.from(files), room);
  };

  const onPaste = (event: ClipboardEvent) => addFiles(event.clipboardData.files);

  const toggleTag = (tag: JournalTagValue) =>
    setTags((current) => {
      const next = new Set(current);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });

  const submit = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      const fields = {
        date: fromDateInputValue(date),
        text: text.trim(),
        tags: JOURNAL_TAGS.filter((tag) => tags.has(tag)),
      };
      let id = entryId;
      const isEdit = id !== undefined;
      if (id) {
        await update.mutateAsync({ id, ...fields });
      } else {
        id = (await create.mutateAsync({ childId, ...fields })).id;
        setEntryId(id);
      }

      for (const photoId of pendingRemoval) {
        await deletePhoto.mutateAsync({ photoId });
      }
      setExisting((current) => current.filter((photo) => !pendingRemoval.has(photo.id)));
      setPendingRemoval(new Set());

      const failed = await queue.uploadAll(id);
      await utils.journal.list.invalidate({ childId });

      if (failed === 0) {
        toast({ title: t(isEdit ? "sheet.updated" : "sheet.created") });
        onClose();
      } else {
        toast({
          title: t("sheet.photosFailed", { count: failed }),
          variant: "destructive",
        });
      }
    } catch (error) {
      onError(error as { message: string });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent onPaste={onPaste}>
        <DialogHeader>
          <DialogTitle>{t(entry ? "sheet.editTitle" : "sheet.newTitle")}</DialogTitle>
          <DialogDescription>{t("sheet.description")}</DialogDescription>
        </DialogHeader>

        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="journal-text">{t("sheet.text")}</Label>
            <Textarea
              id="journal-text"
              ref={textareaRef}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={t("sheet.textPlaceholder")}
              maxLength={MAX_JOURNAL_TEXT_LENGTH}
              disabled={busy}
              rows={3}
              className="max-h-[40dvh] min-h-28 resize-none overflow-y-auto leading-relaxed"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="journal-date">{t("sheet.date")}</Label>
            <Input
              id="journal-date"
              type="date"
              value={date}
              max={todayInputValue()}
              onChange={(event) => setDate(event.target.value)}
              disabled={busy}
              className="h-12"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label>{t("sheet.tags")}</Label>
              {tags.size === 0 && (
                <span className="text-xs text-muted-foreground">{t("sheet.tagsHint")}</span>
              )}
            </div>
            <TagToggles value={tags} onToggle={toggleTag} disabled={busy} />
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label>{t("sheet.photos")}</Label>
              <span className="text-xs text-muted-foreground">
                {t("sheet.photosCount", { count: photoCount, max: MAX_JOURNAL_PHOTOS })}
              </span>
            </div>

            {photoCount > 0 && (
              <ul className="grid grid-cols-3 gap-2">
                {visibleExisting.map((photo, index) => (
                  <PhotoTile
                    key={photo.id}
                    src={photoUrl(photo.id, "thumb")}
                    removeLabel={t("sheet.removePhoto", { index: index + 1 })}
                    disabled={busy}
                    onRemove={() => setPendingRemoval((current) => new Set(current).add(photo.id))}
                  />
                ))}
                {queue.items.map((item, index) => (
                  <PhotoTile
                    key={item.key}
                    src={item.previewUrl}
                    item={item}
                    removeLabel={t("sheet.removePhoto", { index: visibleExisting.length + index + 1 })}
                    retryLabel={t("sheet.retryPhoto", { index: visibleExisting.length + index + 1 })}
                    disabled={busy}
                    onRemove={() => queue.remove(item.key)}
                    onRetry={entryId ? () => void queue.retry(entryId, item.key) : undefined}
                  />
                ))}
              </ul>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-12"
                disabled={busy || room <= 0}
                onClick={() => libraryRef.current?.click()}
              >
                <ImagePlus aria-hidden />
                {t("sheet.addFromLibrary")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="hidden min-h-12 [@media(pointer:coarse)]:inline-flex"
                disabled={busy || room <= 0}
                onClick={() => cameraRef.current?.click()}
              >
                <Camera aria-hidden />
                {t("sheet.takePhoto")}
              </Button>
            </div>
            <p className="hidden text-xs text-muted-foreground [@media(pointer:fine)]:block">
              {t("sheet.pasteHint")}
            </p>

            <input
              ref={libraryRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              data-testid="journal-library-input"
              onChange={(event) => {
                addFiles(event.target.files);
                event.target.value = "";
              }}
            />
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              data-testid="journal-camera-input"
              onChange={(event) => {
                addFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="min-h-12" disabled={busy} onClick={onClose}>
              {tc("cancel")}
            </Button>
            <Button type="submit" className="min-h-12" disabled={!canSave}>
              {busy ? t("sheet.saving") : t("sheet.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PhotoTile({
  src,
  item,
  removeLabel,
  retryLabel,
  disabled,
  onRemove,
  onRetry,
}: {
  src: string;
  item?: QueuedPhoto;
  removeLabel: string;
  retryLabel?: string;
  disabled: boolean;
  onRemove: () => void;
  onRetry?: () => void;
}) {
  const t = useTranslations("journal");
  const sending = item?.status === "preparing" || item?.status === "uploading";

  return (
    <li className="relative aspect-square overflow-hidden rounded-xl bg-muted">
      {/* Local preview or the access-checked route, so next/image does not apply */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className={cn("h-full w-full object-cover", sending && "opacity-60")} />

      {sending && (
        <div className="absolute inset-x-0 bottom-0 space-y-1 bg-black/55 px-2 py-1.5 text-white">
          <p className="flex items-center gap-1 text-xs">
            <LoaderCircle className="h-3 w-3 animate-spin" aria-hidden />
            {t("sheet.uploading")}
          </p>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round((item?.progress ?? 0) * 100)}
            className="h-1 overflow-hidden rounded-full bg-white/30"
          >
            <div
              className="h-full bg-white transition-[width]"
              style={{ width: `${Math.round((item?.progress ?? 0) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {item?.status === "done" && (
        <span className="absolute bottom-1.5 left-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-success text-success-foreground">
          <Check className="h-3.5 w-3.5" aria-hidden />
        </span>
      )}

      {item?.status === "error" && (
        <div
          role="alert"
          className="absolute inset-x-0 bottom-0 bg-destructive/90 px-2 py-1.5 text-xs text-destructive-foreground"
        >
          <p className="line-clamp-2">
            {t(`errors.${item.error ?? "generic"}` as `errors.${UploadErrorCode}`, {
              max: MAX_JOURNAL_PHOTOS,
            })}
          </p>
        </div>
      )}

      {item?.status === "error" && onRetry && (
        <button
          type="button"
          aria-label={retryLabel}
          disabled={disabled}
          onClick={onRetry}
          className="absolute left-0 top-0 flex h-12 w-12 items-start justify-start p-1"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          </span>
        </button>
      )}

      {!sending && (
        <button
          type="button"
          aria-label={removeLabel}
          disabled={disabled}
          onClick={onRemove}
          className="absolute right-0 top-0 flex h-12 w-12 items-start justify-end p-1 disabled:opacity-50"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white">
            <X className="h-4 w-4" aria-hidden />
          </span>
        </button>
      )}
    </li>
  );
}
