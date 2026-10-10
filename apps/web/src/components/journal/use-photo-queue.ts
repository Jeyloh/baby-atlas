"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { downscaleImage, ImageTooLargeError } from "@/lib/chat/downscale-image";
import { UploadError, uploadJournalPhoto, type UploadErrorCode } from "@/lib/journal/upload-photo";

const UPLOAD_EDGE = 2048;
const UPLOAD_MAX_BYTES = 8 * 1024 * 1024;

export type QueuedPhotoStatus = "queued" | "preparing" | "uploading" | "done" | "error";

export interface QueuedPhoto {
  key: string;
  file: File;
  previewUrl: string;
  status: QueuedPhotoStatus;
  progress: number;
  error?: UploadErrorCode;
}

const IMAGE_NAME = /\.(jpe?g|png|webp|heic|heif)$/i;

function isImage(file: File) {
  return file.type.startsWith("image/") || IMAGE_NAME.test(file.name);
}

function errorCode(error: unknown): UploadErrorCode {
  if (error instanceof UploadError) return error.code;
  if (error instanceof ImageTooLargeError) return "too_large";
  return "unreadable_image";
}

/**
 * Photos picked for an entry. They upload after the entry exists, one at a
 * time, and each keeps its own progress and error so one failure does not
 * lose the others.
 */
export function usePhotoQueue() {
  const [items, setItems] = useState<QueuedPhoto[]>([]);
  const itemsRef = useRef(items);
  const counter = useRef(0);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(
    () => () => itemsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl)),
    []
  );

  const patch = useCallback(
    (key: string, changes: Partial<QueuedPhoto>) =>
      setItems((current) => current.map((item) => (item.key === key ? { ...item, ...changes } : item))),
    []
  );

  const add = useCallback((files: File[], room: number) => {
    const accepted = files.filter(isImage).slice(0, Math.max(room, 0));
    if (accepted.length === 0) return;
    setItems((current) => [
      ...current,
      ...accepted.map((file) => ({
        key: `photo-${counter.current++}`,
        file,
        previewUrl: URL.createObjectURL(file),
        status: "queued" as const,
        progress: 0,
      })),
    ]);
  }, []);

  const remove = useCallback((key: string) => {
    const item = itemsRef.current.find((candidate) => candidate.key === key);
    if (item) URL.revokeObjectURL(item.previewUrl);
    setItems((current) => current.filter((candidate) => candidate.key !== key));
  }, []);

  const uploadOne = useCallback(
    async (entryId: string, item: QueuedPhoto): Promise<boolean> => {
      patch(item.key, { status: "preparing", progress: 0, error: undefined });
      try {
        const prepared = await downscaleImage(item.file, {
          maxEdge: UPLOAD_EDGE,
          maxBytes: UPLOAD_MAX_BYTES,
        });
        patch(item.key, { status: "uploading" });
        await uploadJournalPhoto(entryId, prepared, (progress) => patch(item.key, { progress }));
        patch(item.key, { status: "done", progress: 1 });
        return true;
      } catch (error) {
        patch(item.key, { status: "error", error: errorCode(error) });
        return false;
      }
    },
    [patch]
  );

  /** Uploads every photo that is not done. Resolves to how many failed. */
  const uploadAll = useCallback(
    async (entryId: string): Promise<number> => {
      let failed = 0;
      for (const item of itemsRef.current.filter((candidate) => candidate.status !== "done")) {
        if (!(await uploadOne(entryId, item))) failed += 1;
      }
      return failed;
    },
    [uploadOne]
  );

  const retry = useCallback(
    async (entryId: string, key: string) => {
      const item = itemsRef.current.find((candidate) => candidate.key === key);
      if (item) await uploadOne(entryId, item);
    },
    [uploadOne]
  );

  return { items, add, remove, uploadAll, retry };
}
