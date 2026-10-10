import type {
  AttachmentAdapter,
  CompleteAttachment,
  PendingAttachment,
} from "@assistant-ui/react";
import { downscaleImage } from "./downscale-image";

function readAsDataUrl(file: File, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    signal?.addEventListener("abort", () => reader.abort(), { once: true });
    reader.readAsDataURL(file);
  });
}

export class ImageAttachmentAdapter implements AttachmentAdapter {
  accept = "image/*";

  async *add({ file }: { file: File }): AsyncGenerator<PendingAttachment, void> {
    const base = {
      id: crypto.randomUUID(),
      type: "image" as const,
      name: file.name,
      contentType: file.type,
    };
    yield {
      ...base,
      file,
      status: { type: "running", reason: "uploading", progress: 0 },
    };
    const resized = await downscaleImage(file);
    yield {
      ...base,
      contentType: resized.type,
      file: resized,
      status: { type: "requires-action", reason: "composer-send" },
    };
  }

  async send(
    attachment: PendingAttachment,
    options?: { signal?: AbortSignal }
  ): Promise<CompleteAttachment> {
    return {
      ...attachment,
      status: { type: "complete" },
      content: [
        { type: "image", image: await readAsDataUrl(attachment.file, options?.signal) },
      ],
    };
  }

  async remove(): Promise<void> {}
}
