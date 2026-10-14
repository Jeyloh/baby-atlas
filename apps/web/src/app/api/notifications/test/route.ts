import { prisma } from "@baby-atlas/db";
import { auth } from "@/lib/auth";
import { isPushConfigured, sendToSubscriptions } from "@/lib/notifications/send";
import { toLocale } from "@/i18n/config";
import { translatePush } from "@/lib/notifications/translate";

export const runtime = "nodejs";

function jsonResponse(status: number, body: unknown) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** Sends a test notification to the signed-in user's own devices. */
export async function POST() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return jsonResponse(401, { error: "unauthorized" });

  if (!isPushConfigured()) return jsonResponse(503, { error: "push_not_configured" });

  const [subscriptions, settings] = await Promise.all([
    prisma.pushSubscription.findMany({
      where: { userId },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    }),
    prisma.notificationSettings.findUnique({
      where: { userId },
      select: { locale: true },
    }),
  ]);
  if (subscriptions.length === 0) return jsonResponse(409, { error: "no_subscription" });

  const locale = toLocale(settings?.locale);
  const counts = await sendToSubscriptions(
    prisma,
    subscriptions,
    {
      title: translatePush(locale, "push.test.title"),
      body: translatePush(locale, "push.test.body"),
      tag: "test",
      url: "/dashboard/settings",
    },
    { ttlSeconds: 60, urgency: "high", topic: "test" }
  );

  if (counts.sent === 0) return jsonResponse(502, { error: "send_failed", ...counts });
  return jsonResponse(200, counts);
}
