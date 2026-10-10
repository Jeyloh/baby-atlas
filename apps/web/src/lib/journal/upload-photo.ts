export type UploadErrorCode =
  | "unsupported_type"
  | "too_large"
  | "too_many_photos"
  | "heic_unsupported"
  | "unreadable_image"
  | "forbidden"
  | "network"
  | "generic";

const KNOWN_CODES: readonly string[] = [
  "unsupported_type",
  "too_large",
  "too_many_photos",
  "heic_unsupported",
  "unreadable_image",
  "forbidden",
];

export class UploadError extends Error {
  constructor(readonly code: UploadErrorCode) {
    super(code);
    this.name = "UploadError";
  }
}

export interface UploadedPhoto {
  id: string;
  width: number;
  height: number;
  sizeBytes: number;
}

function codeFromResponse(status: number, body: string): UploadErrorCode {
  try {
    const { error } = JSON.parse(body) as { error?: string };
    if (error && KNOWN_CODES.includes(error)) return error as UploadErrorCode;
  } catch {
    // not JSON, fall through to the status
  }
  if (status === 413) return "too_large";
  if (status === 403 || status === 404) return "forbidden";
  return "generic";
}

/** XHR instead of fetch because fetch has no upload progress. */
export function uploadJournalPhoto(
  entryId: string,
  file: File,
  onProgress: (fraction: number) => void
): Promise<UploadedPhoto> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.set("entryId", entryId);
    form.set("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/journal/photos");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onerror = () => reject(new UploadError("network"));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText) as UploadedPhoto);
      } else {
        reject(new UploadError(codeFromResponse(xhr.status, xhr.responseText)));
      }
    };
    xhr.send(form);
  });
}
