"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { photoUrl, type JournalPhotoItem } from "./journal-utils";

const SWIPE_DISTANCE = 50;

/**
 * Full-screen viewer for one entry's photos. Swipe, use the arrow buttons or
 * the arrow keys to step. Escape and the close button leave. Shows the
 * full-size image, with the thumbnail behind it while that loads.
 */
export function PhotoViewer({
  photos,
  startIndex,
  onClose,
}: {
  photos: JournalPhotoItem[];
  startIndex: number;
  onClose: () => void;
}) {
  const t = useTranslations("journal.viewer");
  const [index, setIndex] = useState(startIndex);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  const step = useCallback(
    (direction: -1 | 1) =>
      setIndex((current) => Math.min(Math.max(current + direction, 0), photos.length - 1)),
    [photos.length]
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") step(-1);
      if (event.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  const photo = photos[index];
  if (!photo) return null;

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-black data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-[60] flex flex-col text-white outline-none"
        >
          <DialogPrimitive.Title className="sr-only">{t("title")}</DialogPrimitive.Title>

          <div className="flex items-center justify-between pl-4 pr-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
            <p className="text-sm tabular-nums" aria-live="polite">
              {t("position", { index: index + 1, count: photos.length })}
            </p>
            <DialogPrimitive.Close
              aria-label={t("close")}
              className="flex h-12 w-12 items-center justify-center rounded-full hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <X className="h-6 w-6" aria-hidden />
            </DialogPrimitive.Close>
          </div>

          <div
            className="relative flex min-h-0 flex-1 touch-pan-y items-center justify-center"
            onPointerDown={(event) => {
              swipeStart.current = { x: event.clientX, y: event.clientY };
            }}
            onPointerUp={(event) => {
              const start = swipeStart.current;
              swipeStart.current = null;
              if (!start) return;
              const dx = event.clientX - start.x;
              const dy = event.clientY - start.y;
              if (Math.abs(dx) > SWIPE_DISTANCE && Math.abs(dx) > Math.abs(dy)) {
                step(dx < 0 ? 1 : -1);
              }
            }}
            onPointerCancel={() => {
              swipeStart.current = null;
            }}
          >
            {/* Thumbnail first, so something shows while the full image loads */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={photo.id}
              src={photoUrl(photo.id, "full")}
              alt=""
              data-testid="journal-viewer-image"
              draggable={false}
              style={{ backgroundImage: `url(${photoUrl(photo.id, "thumb")})` }}
              className="max-h-full max-w-full select-none bg-contain bg-center bg-no-repeat object-contain"
            />

            {photos.length > 1 && (
              <>
                <StepButton
                  side="left"
                  label={t("previous")}
                  disabled={index === 0}
                  onClick={() => step(-1)}
                />
                <StepButton
                  side="right"
                  label={t("next")}
                  disabled={index === photos.length - 1}
                  onClick={() => step(1)}
                />
              </>
            )}
          </div>

          <div className="h-[max(0.75rem,env(safe-area-inset-bottom))]" />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function StepButton({
  side,
  label,
  disabled,
  onClick,
}: {
  side: "left" | "right";
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      className={cn(
        "absolute top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-0",
        side === "left" ? "left-2" : "right-2"
      )}
    >
      <Icon className="h-6 w-6" aria-hidden />
    </button>
  );
}
