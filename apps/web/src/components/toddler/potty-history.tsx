"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import type { PottySignal } from "@baby-atlas/schemas";
import { trpc } from "@/lib/trpc/provider";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "./confirm-dialog";
import { useErrorToast } from "./use-error-toast";

export interface PottyLogItem {
  id: string;
  time: Date;
  signals: PottySignal[];
  notes: string | null;
}

export function PottyHistory({ childId, logs }: { childId: string; logs: PottyLogItem[] }) {
  const t = useTranslations("potty");
  const format = useFormatter();
  const { toast } = useToast();
  const onError = useErrorToast(t("errorTitle"));
  const utils = trpc.useUtils();
  const [deleting, setDeleting] = useState<PottyLogItem | null>(null);

  const remove = trpc.potty.delete.useMutation({
    onSuccess: () => {
      utils.potty.list.invalidate({ childId });
      toast({ title: t("history.deleted") });
      setDeleting(null);
    },
    onError,
  });

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{t("history.title")}</h2>
      {logs.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
          {t("history.empty")}
        </p>
      ) : (
        <ul className="space-y-2">
          {logs.map((log) => (
            <li key={log.id} className="flex items-start gap-1 rounded-xl border bg-card py-2 pl-4 pr-1">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-medium">
                  {format.dateTime(log.time, {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                    hourCycle: "h23",
                  })}
                </p>
                <ul className="flex flex-wrap gap-1">
                  {log.signals.map((signal) => (
                    <li key={signal} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs text-primary">
                      {t(`signals.${signal}`)}
                    </li>
                  ))}
                </ul>
                {log.notes && <p className="text-sm text-muted-foreground">{log.notes}</p>}
              </div>
              <Button
                variant="ghost"
                size="icon-lg"
                className="h-12 w-12 shrink-0 text-destructive"
                aria-label={t("history.delete")}
                onClick={() => setDeleting(log)}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={deleting !== null}
        title={t("history.delete")}
        description={deleting?.signals.map((s) => t(`signals.${s}`)).join(", ") ?? ""}
        pending={remove.isPending}
        onOpenChange={(open) => !open && setDeleting(null)}
        onConfirm={() => deleting && remove.mutate({ id: deleting.id })}
      />
    </section>
  );
}
