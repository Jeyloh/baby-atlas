import { prisma } from "@baby-atlas/db";
import { storePushSubscription } from "@baby-atlas/api";
import { resubscribePushSchema } from "@baby-atlas/schemas";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

function jsonResponse(status: number, body: unknown) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Called by the service worker when the browser replaced a push subscription
 * (`pushsubscriptionchange`). The session cookie identifies the user. The
 * swap only happens when the old endpoint belongs to that user, so a
 * different account on the same browser cannot take over someone's device.
 */
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return jsonResponse(401, { error: "unauthorized" });

  const body = resubscribePushSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonResponse(400, { error: "invalid_body" });
  const { oldEndpoint, newEndpoint, keys } = body.data;

  const previous = await prisma.pushSubscription.findUnique({
    where: { endpoint: oldEndpoint },
    select: { userId: true, userAgent: true },
  });
  if (!previous || previous.userId !== userId) return jsonResponse(404, { error: "not_found" });

  await storePushSubscription(prisma, userId, {
    endpoint: newEndpoint,
    keys,
    userAgent: previous.userAgent ?? undefined,
  });
  if (oldEndpoint !== newEndpoint) {
    await prisma.pushSubscription.deleteMany({ where: { endpoint: oldEndpoint, userId } });
  }

  return jsonResponse(200, { success: true });
}
