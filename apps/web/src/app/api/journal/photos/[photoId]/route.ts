import { prisma } from "@baby-atlas/db";
import { journalThumbKey } from "@baby-atlas/utils";
import { auth } from "@/lib/auth";
import { getChildMembership } from "@/lib/journal/access";
import { getStorage } from "@/lib/storage";

export const runtime = "nodejs";

const notFound = () => new Response(null, { status: 404 });

/**
 * Streams a journal photo to household members. A photo the user may not see
 * answers 404, the same as one that does not exist.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ photoId: string }> }
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response(null, { status: 401 });

  const { photoId } = await params;
  const photo = await prisma.journalPhoto.findUnique({
    where: { id: photoId },
    select: { storageKey: true, entry: { select: { childId: true } } },
  });
  if (!photo?.storageKey) return notFound();

  const membership = await getChildMembership(userId, photo.entry.childId);
  if (!membership) return notFound();

  const size = new URL(request.url).searchParams.get("size") === "thumb" ? "thumb" : "full";
  const key = size === "thumb" ? journalThumbKey(photo.storageKey) : photo.storageKey;

  const object = await getStorage().get(key);
  if (!object) return notFound();

  const headers = new Headers({
    "Content-Type": object.mimeType,
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff",
    Vary: "Cookie",
  });
  if (object.size !== undefined) headers.set("Content-Length", String(object.size));

  return new Response(object.stream, { headers });
}
