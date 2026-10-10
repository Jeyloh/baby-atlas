"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { photoTiles, photoUrl, singlePhotoAspect, type JournalPhotoItem } from "./journal-utils";

/**
 * One photo fills the width, two sit side by side, three or more fill a
 * 3-column row where the last tile shows how many more there are.
 */
export function PhotoGrid({
  photos,
  onOpen,
}: {
  photos: JournalPhotoItem[];
  onOpen: (index: number) => void;
}) {
  const t = useTranslations("journal.photos");
  const { visible, hidden } = photoTiles(photos.length);
  if (photos.length === 0) return null;

  const tiles = photos.slice(0, visible);
  const single = photos.length === 1 ? photos[0]! : null;

  return (
    <div
      className={cn(
        "grid gap-1 overflow-hidden rounded-xl",
        photos.length === 1 && "grid-cols-1",
        photos.length === 2 && "grid-cols-2",
        photos.length >= 3 && "grid-cols-3"
      )}
    >
      {tiles.map((photo, index) => {
        const isLastTile = index === visible - 1 && hidden > 0;
        return (
          <button
            key={photo.id}
            type="button"
            onClick={() => onOpen(index)}
            aria-label={t("open", { index: index + 1, count: photos.length })}
            style={single ? { aspectRatio: singlePhotoAspect(single.width, single.height) } : undefined}
            className={cn(
              "relative block min-h-12 w-full overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              !single && "aspect-square"
            )}
          >
            {/* Private route behind an access check, so next/image optimisation does not apply */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoUrl(photo.id, "thumb")}
              alt={t("alt", { index: index + 1, count: photos.length })}
              width={photo.width}
              height={photo.height}
              loading="lazy"
              draggable={false}
              className="h-full w-full object-cover"
            />
            {isLastTile && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/55 font-display text-2xl font-semibold text-white">
                +{hidden}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
