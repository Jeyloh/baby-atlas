import { createHash, timingSafeEqual } from "node:crypto";
import { prisma } from "@baby-atlas/db";
import { runDispatcher } from "@/lib/notifications/dispatcher";
import { isPushConfigured } from "@/lib/notifications/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function jsonResponse(status: number, body: unknown) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** Compares secrets in constant time (hashing first makes the lengths equal). */
function bearerMatches(header: string | null, secret: string): boolean {
  const prefix = "Bearer ";
  if (!header?.startsWith(prefix)) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(header.slice(prefix.length)), digest(secret));
}

/**
 * Runs the notification dispatcher. Called every few minutes by an external
 * scheduler and once a day by Vercel Cron, both with
 * `Authorization: Bearer ${CRON_SECRET}`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  // Without a secret nobody is let in
  if (!secret || !bearerMatches(request.headers.get("authorization"), secret)) {
    return jsonResponse(401, { error: "unauthorized" });
  }

  if (!isPushConfigured()) {
    return jsonResponse(503, { error: "push_not_configured" });
  }

  try {
    const result = await runDispatcher({ prisma });
    return jsonResponse(200, result);
  } catch (error) {
    console.error("[notifications] dispatcher run failed", error);
    return jsonResponse(500, { error: "dispatch_failed" });
  }
}
