"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@baby-atlas/api";
import { trpc } from "@/lib/trpc/provider";
import { useFormatters } from "@/lib/format";
import type { SupportCardProps } from "./types";

/** How long the home view must be visible before the visit counts as seen. */
const SEEN_AFTER_MS = 5000;
/** Coming back to a hidden tab after this long starts a new visit. */
const NEW_VISIT_AFTER_HIDDEN_MS = 2 * 60 * 60 * 1000;

/**
 * "Since you were last here": what happened while the user was away. Shown
 * once per visit. The visit is marked seen when the card is dismissed or after
 * the home view has been visible for a few seconds, which also starts the
 * tracking on a first ever visit (no card then). Marking is best effort: when
 * it fails offline it is ignored and tried again on the next visit.
 */
export function HandoverCard({ childId }: SupportCardProps) {
  const [visit, setVisit] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const mountedAt = useRef(Date.now());
  const { mutate } = trpc.handover.markSeen.useMutation({ onError: () => undefined });

  // Never refetched while the page is open, or the summary would vanish the
  // moment the visit is marked. A saved copy from an earlier session is ignored.
  const query = trpc.handover.summary.useQuery(
    { childId },
    {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchInterval: false,
      retry: false,
      staleTime: 0,
      gcTime: 0,
    }
  );
  const { refetch, data, dataUpdatedAt, isSuccess } = query;
  const fresh = isSuccess && dataUpdatedAt >= mountedAt.current;

  // Snapshot of the summary for this visit, so a refetch cannot change it
  const [snapshot, setSnapshot] = useState<typeof data | undefined>(undefined);
  useEffect(() => {
    if (fresh && snapshot === undefined) setSnapshot(data ?? null);
  }, [fresh, data, snapshot]);

  const markNow = useCallback(() => mutate({ childId }), [mutate, childId]);

  // Mark the visit seen once the view has been visible for a while
  useEffect(() => {
    if (snapshot === undefined || dismissed) return;
    const timer = window.setTimeout(() => {
      if (document.visibilityState === "visible") markNow();
    }, SEEN_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [snapshot, dismissed, markNow, visit]);

  // An installed app can stay open for hours: a long absence starts a new visit
  useEffect(() => {
    let hiddenAt: number | null = null;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      if (hiddenAt !== null && Date.now() - hiddenAt >= NEW_VISIT_AFTER_HIDDEN_MS) {
        mountedAt.current = Date.now();
        setSnapshot(undefined);
        setDismissed(false);
        setVisit((v) => v + 1);
        void refetch();
      }
      hiddenAt = null;
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [refetch]);

  if (!snapshot || dismissed) return null;

  return (
    <HandoverSummary
      summary={snapshot}
      onDismiss={() => {
        setDismissed(true);
        markNow();
      }}
    />
  );
}

type Summary = NonNullable<inferRouterOutputs<AppRouter>["handover"]["summary"]>;

function HandoverSummary({ summary, onDismiss }: { summary: Summary; onDismiss: () => void }) {
  const t = useTranslations("support.handover");
  const tCommon = useTranslations("enums");
  const tFormat = useTranslations("format");
  const f = useFormatters();

  const lines: string[] = [];

  if (summary.sleep.totalMinutes > 0) {
    lines.push(t("sleepTotal", { duration: f.duration(summary.sleep.totalMinutes) }));
  }

  if (summary.feeds.count > 0 && summary.feeds.latest) {
    const latest = summary.feeds.latest;
    let detail = tCommon(`feedingType.${latest.type}`).toLowerCase();
    if (latest.amountMl) {
      detail += ` ${tFormat("units.ml", { value: latest.amountMl })}`;
    } else if (latest.side) {
      detail += ` (${t(`side.${latest.side}`)})`;
    }
    lines.push(
      t("feeds", { count: summary.feeds.count, detail, time: f.time(latest.time) })
    );
  }

  if (summary.diapers.wet + summary.diapers.dirty > 0) {
    lines.push(t("diapers", { wet: summary.diapers.wet, dirty: summary.diapers.dirty }));
  }

  if (summary.medicine.count > 0 && summary.medicine.latest) {
    lines.push(
      t("medicine", {
        count: summary.medicine.count,
        name: summary.medicine.latest.name,
        time: f.time(summary.medicine.latest.time),
      })
    );
  }

  if (summary.temperature.latest) {
    lines.push(
      t("temperature", {
        value: tFormat("units.celsius", { value: f.number(summary.temperature.latest.celsius) }),
        time: f.time(summary.temperature.latest.time),
      })
    );
  }

  if (summary.running.length > 0) {
    lines.push(
      t("running", {
        items: summary.running
          .map((r) =>
            t("runningItem", { label: t(`runningType.${r.type}`), time: f.time(r.startTime) })
          )
          .join(", "),
      })
    );
  }

  return (
    <section
      aria-labelledby="handover-title"
      className="relative rounded-lg border bg-card p-4 pr-12 text-card-foreground"
    >
      <h2 id="handover-title" className="font-display text-base font-semibold leading-tight">
        {t("title", { when: f.dateTime(summary.since) })}
      </h2>
      {lines.length > 0 ? (
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">{t("nothing")}</p>
      )}
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t("dismiss")}
        className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-5 w-5" />
      </button>
    </section>
  );
}
