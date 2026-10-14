import type { PrismaClient } from "@baby-atlas/db";
import type { NotificationKind } from "@baby-atlas/schemas";

export type { NotificationKind };

/**
 * Something worth telling members of a household about. Evaluators return
 * candidates for every notice that is relevant right now; the dispatcher
 * decides who gets it and makes sure each person gets it only once.
 */
export interface Candidate {
  kind: NotificationKind;
  childId: string;
  /**
   * Identifies this notice for one person: (userId, dedupeKey) is logged once
   * sent. Include what makes the notice new, for example the record id and the
   * threshold tier (`timer:${recordId}:2x`) or the week (`tip:${childId}:2026-W42`).
   */
  dedupeKey: string;
  /** Path to open when the notification is tapped, for example `/dashboard/<childId>` */
  url: string;
  /** Message keys inside the `notifications` namespace, translated per recipient */
  titleKey: string;
  bodyKey: string;
  /** ICU parameters for the two messages */
  params: Record<string, string | number>;
  /**
   * Notices with the same replaceKey replace each other on the device while
   * unread (for example both tiers of one forgotten timer). Default: dedupeKey.
   */
  replaceKey?: string;
  /**
   * Only these users (still household members). Default: all household members
   * of the child except viewers.
   */
  audience?: string[];
}

export interface EvaluatorContext {
  prisma: PrismaClient;
  now: Date;
}

/** Returns the candidates that are relevant at `ctx.now`. Must not send or write. */
export type Evaluate = (ctx: EvaluatorContext) => Promise<Candidate[]>;

export interface PushPayload {
  title: string;
  body: string;
  /** Replaces an earlier notification with the same tag on the device */
  tag: string;
  url: string;
}
