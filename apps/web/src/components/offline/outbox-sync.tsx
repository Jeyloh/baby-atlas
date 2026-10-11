"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { useTranslations } from "next-intl";
import { claimDeviceData, clearDeviceData } from "@/lib/offline/query-persister";
import { trpc } from "@/lib/trpc/provider";
import { useToast } from "@/hooks/use-toast";
import {
  flushOutbox,
  isUnsent,
  pruneSynced,
  syncedKeys,
  useOutbox,
  type OutboxEntry,
  type OutboxOp,
} from "@/lib/offline/outbox";

type Client = ReturnType<typeof trpc.useUtils>["client"];

function send(client: Client, op: OutboxOp): Promise<unknown> {
  switch (op.path) {
    case "diaper.log": return client.diaper.log.mutate(op.input);
    case "diaper.delete": return client.diaper.delete.mutate(op.input);
    case "feeding.logBottle": return client.feeding.logBottle.mutate(op.input);
    case "feeding.startBreastfeeding": return client.feeding.startBreastfeeding.mutate(op.input);
    case "feeding.switchBreastfeedingSide": return client.feeding.switchBreastfeedingSide.mutate(op.input);
    case "feeding.endBreastfeeding": return client.feeding.endBreastfeeding.mutate(op.input);
    case "feeding.delete": return client.feeding.delete.mutate(op.input);
    case "sleep.start": return client.sleep.start.mutate(op.input);
    case "sleep.end": return client.sleep.end.mutate(op.input);
    case "sleep.delete": return client.sleep.delete.mutate(op.input);
    case "pumping.start": return client.pumping.start.mutate(op.input);
    case "pumping.end": return client.pumping.end.mutate(op.input);
    case "pumping.delete": return client.pumping.delete.mutate(op.input);
  }
}

const MAX_RETRY_DELAY_MS = 60_000;

/**
 * The user the server confirms for the current session, asked directly and
 * never taken from the saved cache, which may belong to someone else. Saved
 * data of another user, or of a session that has ended, is cleared here.
 * Undefined while offline: nothing can be sent then anyway.
 */
function useVerifiedUserId(utils: ReturnType<typeof trpc.useUtils>) {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string>();

  useEffect(() => {
    let stopped = false;
    const verify = async () => {
      try {
        const user = await utils.client.user.get.query();
        if (stopped || !user) return;
        await claimDeviceData(queryClient, user.id);
        setUserId(user.id);
      } catch (error) {
        if (stopped) return;
        const code = error instanceof TRPCClientError ? error.data?.code : undefined;
        if (code === "UNAUTHORIZED") {
          await clearDeviceData(queryClient);
          setUserId(undefined);
        }
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void verify();
    };

    void verify();
    window.addEventListener("online", verify);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.removeEventListener("online", verify);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [utils, queryClient]);

  return userId;
}

/**
 * Sends queued quick actions: right after they are queued, when the device
 * comes back online or to the foreground, and on a growing delay while the
 * server cannot be reached.
 */
export function OutboxSync() {
  const t = useTranslations("quickActions");
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const userId = useVerifiedUserId(utils);

  useEffect(() => {
    if (!userId) return;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let retryDelay = 2_000;
    let stopped = false;

    const refreshAndPrune = async () => {
      const keys = syncedKeys();
      if (!keys.length) return;
      await Promise.all([
        utils.timeline.invalidate(),
        utils.sleep.invalidate(),
        utils.feeding.invalidate(),
        utils.diaper.invalidate(),
        utils.pumping.invalidate(),
      ]);
      pruneSynced(keys);
    };

    const flush = async () => {
      clearTimeout(retryTimer);
      const result = await flushOutbox(
        userId,
        (op) => send(utils.client, op),
        () => toast({ title: t("syncFailed"), variant: "destructive" })
      );
      if (stopped) return;
      void refreshAndPrune();

      if (result.blocked) {
        retryTimer = setTimeout(() => void flush(), retryDelay);
        retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY_MS);
        return;
      }
      retryDelay = 2_000;
      // An entry queued while the last pass was finishing
      if (useOutbox.getState().entries.some((e) => isUnsent(e, userId))) void flush();
    };

    const flushNow = () => {
      retryDelay = 2_000;
      void flush();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") flushNow();
    };

    const unsentCount = (entries: OutboxEntry[]) => entries.filter((e) => isUnsent(e, userId)).length;
    const unsubscribe = useOutbox.subscribe((state, previous) => {
      if (unsentCount(state.entries) > unsentCount(previous.entries)) flushNow();
    });
    window.addEventListener("online", flushNow);
    document.addEventListener("visibilitychange", onVisible);
    void flush();

    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      unsubscribe();
      window.removeEventListener("online", flushNow);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId, utils, toast, t]);

  return null;
}
