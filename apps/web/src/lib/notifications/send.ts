import { createHash } from "node:crypto";
import webpush from "web-push";
import type { PrismaClient } from "@baby-atlas/db";
import type { PushPayload } from "./types";

/** Delete a subscription after this many permanent rejections in a row */
export const MAX_FAILURES = 5;
/** Client errors that mean this subscription is wrong, not that the push service is down */
const PERMANENT_STATUS_CODES = new Set([400, 403, 413]);
/** A subscription that only ever sees temporary errors is dropped after this long without a success */
export const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
/** A push service that does not answer should not hold up a whole run */
export const SEND_TIMEOUT_MS = 10_000;

interface VapidConfig {
  subject: string;
  publicKey: string;
  privateKey: string;
}

/** null when push is not set up (or the subject is not a mailto: or https: URL). */
export function getVapidConfig(env: NodeJS.ProcessEnv = process.env): VapidConfig | null {
  const subject = env.VAPID_SUBJECT?.trim();
  const publicKey = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.VAPID_PRIVATE_KEY?.trim();
  if (!subject || !publicKey || !privateKey) return null;
  if (!/^(mailto:|https:\/\/)/.test(subject)) return null;
  return { subject, publicKey, privateKey };
}

export function isPushConfigured(): boolean {
  return getVapidConfig() !== null;
}

export interface StoredSubscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  lastSuccessAt: Date | null;
  createdAt: Date;
}

export interface SendOptions {
  ttlSeconds: number;
  urgency?: "very-low" | "low" | "normal" | "high";
  /** A newer notice with the same topic replaces one that has not been delivered yet */
  topic?: string;
}

export type SendResult =
  | { ok: true }
  | { ok: false; gone: boolean; statusCode?: number };

export type PushSender = (
  subscription: StoredSubscription,
  payload: PushPayload,
  options: SendOptions
) => Promise<SendResult>;

/** Push topics allow at most 32 URL-safe base64 characters. */
export function topicFor(value: string): string {
  return createHash("sha256").update(value).digest("base64url").slice(0, 32);
}

/** Sends one push message through the web-push library. */
export const sendWebPush: PushSender = async (subscription, payload, options) => {
  const vapid = getVapidConfig();
  if (!vapid) return { ok: false, gone: false };
  try {
    await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
      JSON.stringify(payload),
      {
        vapidDetails: vapid,
        TTL: options.ttlSeconds,
        timeout: SEND_TIMEOUT_MS,
        urgency: options.urgency,
        topic: options.topic,
      }
    );
    return { ok: true };
  } catch (error) {
    const statusCode =
      typeof error === "object" && error !== null && "statusCode" in error
        ? Number((error as { statusCode: unknown }).statusCode)
        : undefined;
    // 404 and 410 mean the browser dropped the subscription for good
    return { ok: false, gone: statusCode === 404 || statusCode === 410, statusCode };
  }
};

export interface DeliveryCounts {
  sent: number;
  removed: number;
  failed: number;
}

/**
 * Sends to each subscription and keeps the table tidy:
 * - 404 and 410 (the browser dropped it): deleted at once
 * - 400, 403, 413 (the service rejects this subscription): counted, deleted
 *   after MAX_FAILURES in a row; a success resets the count
 * - anything else (5xx, 429, timeouts, no network): never counts, because the
 *   push service may just be down. Deleted only when the subscription has had
 *   no success for STALE_AFTER_MS (counted from creation if it never had one).
 */
export async function sendToSubscriptions(
  prisma: PrismaClient,
  subscriptions: StoredSubscription[],
  payload: PushPayload,
  options: SendOptions,
  sender: PushSender = sendWebPush,
  now: Date = new Date()
): Promise<DeliveryCounts> {
  const counts: DeliveryCounts = { sent: 0, removed: 0, failed: 0 };

  await Promise.all(
    subscriptions.map(async (subscription) => {
      const result = await sender(subscription, payload, options);

      if (result.ok) {
        counts.sent += 1;
        // updateMany: the row may be gone already (the user turned push off)
        await prisma.pushSubscription.updateMany({
          where: { id: subscription.id },
          data: { failureCount: 0, lastSuccessAt: now },
        });
        return;
      }

      counts.failed += 1;
      const remove = async () => {
        await prisma.pushSubscription.deleteMany({ where: { id: subscription.id } });
        counts.removed += 1;
      };

      if (result.gone) {
        await remove();
        return;
      }

      if (result.statusCode === undefined || !PERMANENT_STATUS_CODES.has(result.statusCode)) {
        const lastGood = subscription.lastSuccessAt ?? subscription.createdAt;
        if (now.getTime() - lastGood.getTime() > STALE_AFTER_MS) await remove();
        return;
      }

      await prisma.pushSubscription.updateMany({
        where: { id: subscription.id },
        data: { failureCount: { increment: 1 } },
      });
      const current = await prisma.pushSubscription.findUnique({
        where: { id: subscription.id },
        select: { failureCount: true },
      });
      if (current && current.failureCount >= MAX_FAILURES) await remove();
    })
  );

  return counts;
}
