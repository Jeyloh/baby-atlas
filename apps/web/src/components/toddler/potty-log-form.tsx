"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { PottySignal } from "@baby-atlas/schemas";
import { trpc } from "@/lib/trpc/provider";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PottySignalPicker } from "./potty-signal-picker";
import { useErrorToast } from "./use-error-toast";

export function PottyLogForm({ childId }: { childId: string }) {
  const t = useTranslations("potty");
  const { toast } = useToast();
  const onError = useErrorToast(t("errorTitle"));
  const utils = trpc.useUtils();
  const [selected, setSelected] = useState<PottySignal[]>([]);
  const [notes, setNotes] = useState("");

  const log = trpc.potty.log.useMutation({
    onSuccess: () => {
      utils.potty.list.invalidate({ childId });
      toast({ title: t("logged") });
      setSelected([]);
      setNotes("");
    },
    onError,
  });

  const toggle = (signal: PottySignal) =>
    setSelected((current) =>
      current.includes(signal) ? current.filter((s) => s !== signal) : [...current, signal]
    );

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">{t("signals.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("signals.hint")}</p>
      </div>
      <PottySignalPicker selected={selected} onToggle={toggle} />
      <Input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder={t("notes")}
        aria-label={t("notes")}
        maxLength={500}
        className="h-12 text-base"
      />
      <Button
        className="min-h-12 w-full text-base"
        disabled={selected.length === 0 || log.isPending}
        onClick={() =>
          log.mutate({
            childId,
            time: new Date(),
            signals: selected,
            notes: notes.trim() || undefined,
          })
        }
      >
        {selected.length === 0 ? t("selectFirst") : t("logSelected", { count: selected.length })}
      </Button>
    </section>
  );
}
