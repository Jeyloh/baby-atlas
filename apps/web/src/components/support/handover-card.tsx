"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { isToday } from "date-fns";
import { X } from "lucide-react";
import { create } from "zustand";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@baby-atlas/api";
import { trpc } from "@/lib/trpc/provider";
import { useFormatters } from "@/lib/format";
import type { SupportCardProps } from "./types";

type Summary = NonNullable<inferRouterOutputs<AppRouter>["handover"]["summary"]>;

/** How long the card must be on screen before the visit counts as seen. */
const SEEN_AFTER_MS = 5000;
/** Coming back to a hidden tab after this long starts a new visit. */
const NEW_VISIT_AFTER_HIDDEN_MS = 2 * 60 * 60 * 1000;

interface VisitState {
  /** The summary for this visit; null means there is nothing to show */
  snapshot: Summary | null;
  dismissed: boolean;
  marked: boolean;
}

/**
 * The visit per child for the app session. The home tab unmounts when the
 * user opens Reports, so the card they were reading must survive that, and
 * the visit must not be marked a second time.
 */
const useVisits = create<{ byChild: Record<string, VisitState | undefined> }>(() => ({
  byChild: {},
}));

function patchVisit(childId: string, patch: Partial<VisitState>) {
  useVisits.setState((s) => {
    const current = s.byChild[childId];
    return current ? { byChild: { ...s.byChild, [childId]: { ...current, ...patch } } } : s;
  });
}

function usePageVisible() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const update = () => setVisible(document.visibilityState === "visible");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
}

/**
 * "Since you were last here": what happened while the user was away. Shown
 * once per visit. The visit is marked seen when the card is dismissed or after
 * the card has been on screen for a few seconds, which also starts the
 * tracking on a first ever visit (no card then). Marking is best effort: when
 * it fails offline it is ignored and tried again on the next visit.
 */
export function HandoverCard({ childId }: SupportCardProps) {
  const visit = useVisits((s) => s.byChild[childId]);
  const mountedAt = useRef(Date.now());
  const pageVisible = usePageVisible();
  const [onScreen, setOnScreen] = useState(false);
  const rootRef = useRef<HTMLElement | null>(null);
  const { mutate } = trpc.handover.markSeen.useMutation({ onError: () => undefined });

  // Fetched once per visit, never refetched while the page is open, or the
  // summary would vanish the moment the visit is marked. A saved copy from an
  // earlier session is ignored.
  const query = trpc.handover.summary.useQuery(
    { childId },
    {
      enabled: !visit,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchInterval: false,
      retry: false,
      staleTime: 0,
      gcTime: 0,
    }
  );
  const { refetch, data, dataUpdatedAt, isSuccess } = query;

  useEffect(() => {
    if (!visit && isSuccess && dataUpdatedAt >= mountedAt.current) {
      useVisits.setState((s) => ({
        byChild: {
          ...s.byChild,
          [childId]: { snapshot: data ?? null, dismissed: false, marked: false },
        },
      }));
    }
  }, [visit, isSuccess, dataUpdatedAt, data, childId]);

  const hasCard = !!visit?.snapshot && !visit.dismissed;

  // Observe the card itself; with no card the home view being visible is enough
  const setRoot = useCallback((node: HTMLElement | null) => {
    rootRef.current = node;
    if (!node) setOnScreen(false);
  }, []);
  useEffect(() => {
    const node = rootRef.current;
    if (!hasCard || !node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setOnScreen(!!entry?.isIntersecting),
      { threshold: 0.5 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasCard]);

  const shouldTime = !!visit && !visit.marked && pageVisible && (!hasCard || onScreen);
  useEffect(() => {
    if (!shouldTime) return;
    const timer = window.setTimeout(() => {
      patchVisit(childId, { marked: true });
      mutate({ childId });
    }, SEEN_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [shouldTime, childId, mutate]);

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
        useVisits.setState((s) => ({ byChild: { ...s.byChild, [childId]: undefined } }));
        void refetch();
      }
      hiddenAt = null;
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [refetch, childId]);

  if (!visit?.snapshot || visit.dismissed) return null;

  return (
    <HandoverSummary
      ref={setRoot}
      summary={visit.snapshot}
      onDismiss={() => {
        patchVisit(childId, { dismissed: true, marked: true });
        if (!visit.marked) mutate({ childId });
      }}
    />
  );
}

function HandoverSummary({
  summary,
  onDismiss,
  ref,
}: {
  summary: Summary;
  onDismiss: () => void;
  ref: (node: HTMLElement | null) => void;
}) {
  const t = useTranslations("support.handover");
  const tEnums = useTranslations("enums");
  const tFormat = useTranslations("format");
  const f = useFormatters();

  /** The time alone for today, otherwise with the day */
  const when = (d: Date) => (isToday(d) ? f.time(d) : f.dateTime(d));

  const lines: string[] = [];

  if (summary.sleep.totalMinutes > 0) {
    lines.push(t("sleepTotal", { duration: f.duration(summary.sleep.totalMinutes) }));
  }

  if (summary.feeds.count > 0 && summary.feeds.latest) {
    const latest = summary.feeds.latest;
    let detail = tEnums(`feedingType.${latest.type}`).toLowerCase();
    if (latest.amountMl) {
      detail += ` ${tFormat("units.ml", { value: latest.amountMl })}`;
    } else if (latest.side) {
      detail += ` (${t(`side.${latest.side}`)})`;
    }
    lines.push(t("feeds", { count: summary.feeds.count, detail, time: when(latest.time) }));
  }

  if (summary.diapers.wet + summary.diapers.dirty > 0) {
    lines.push(t("diapers", { wet: summary.diapers.wet, dirty: summary.diapers.dirty }));
  }
  if (summary.diapers.dry > 0) {
    lines.push(t("dryDiapers", { count: summary.diapers.dry }));
  }

  if (summary.pumping.count > 0) lines.push(t("pumping", { count: summary.pumping.count }));
  if (summary.activities.count > 0) {
    lines.push(t("activities", { count: summary.activities.count }));
  }

  if (summary.medicine.count > 0 && summary.medicine.latest) {
    lines.push(
      t("medicine", {
        count: summary.medicine.count,
        name: summary.medicine.latest.name,
        time: when(summary.medicine.latest.time),
      })
    );
  }

  if (summary.temperature.latest) {
    lines.push(
      t("temperature", {
        value: tFormat("units.celsius", { value: f.number(summary.temperature.latest.celsius) }),
        time: when(summary.temperature.latest.time),
      })
    );
  }

  if (summary.running.length > 0) {
    lines.push(
      t("running", {
        items: summary.running
          .map((r) =>
            t("runningItem", { label: t(`runningType.${r.type}`), time: when(r.startTime) })
          )
          .join(", "),
      })
    );
  }

  // The data covers at most the last 24 hours, whatever the absence
  const clipped = summary.since.getTime() < summary.windowStart.getTime();

  return (
    <section
      ref={ref}
      aria-labelledby="handover-title"
      className="relative rounded-lg border bg-card p-4 pr-12 text-card-foreground"
    >
      <h2 id="handover-title" className="font-display text-base font-semibold leading-tight">
        {clipped
          ? t("titleClipped", { when: f.dateTime(summary.since) })
          : t("title", { when: f.dateTime(summary.since) })}
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
