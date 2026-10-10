"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import type { SpeechCategory } from "@baby-atlas/schemas";
import { trpc } from "@/lib/trpc/provider";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CategoryToggle } from "./category-toggle";
import { fromDateInputValue, todayInputValue } from "./date-input";
import { useErrorToast } from "./use-error-toast";

export function SpeechQuickAdd({ childId }: { childId: string }) {
  const t = useTranslations("speech");
  const { toast } = useToast();
  const onError = useErrorToast(t("errorTitle"));
  const utils = trpc.useUtils();
  const [word, setWord] = useState("");
  const [category, setCategory] = useState<SpeechCategory>("WORD");
  const [date, setDate] = useState(todayInputValue);

  const add = trpc.speech.add.useMutation({
    onSuccess: (created) => {
      utils.speech.list.invalidate({ childId });
      toast({ title: t("quickAdd.added", { word: created.word }) });
      setWord("");
    },
    onError,
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = word.trim();
    if (!trimmed || !date || add.isPending) return;
    add.mutate({ childId, word: trimmed, category, firstSaidAt: fromDateInputValue(date) });
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border bg-card p-4">
      <CategoryToggle value={category} onChange={setCategory} />
      <div className="flex gap-2">
        <Input
          value={word}
          onChange={(e) => setWord(e.target.value)}
          placeholder={t("quickAdd.placeholder")}
          aria-label={t("quickAdd.label")}
          maxLength={100}
          autoComplete="off"
          enterKeyHint="done"
          className="h-12 text-base"
        />
        <Button
          type="submit"
          size="icon-lg"
          className="h-12 w-12 shrink-0"
          disabled={!word.trim() || add.isPending}
          aria-label={t("quickAdd.add")}
        >
          <Plus className="!size-5" />
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Label htmlFor="speech-date" className="text-sm text-muted-foreground">
          {t("quickAdd.dateLabel")}
        </Label>
        <Input
          id="speech-date"
          type="date"
          value={date}
          max={todayInputValue()}
          onChange={(e) => setDate(e.target.value)}
          className="h-12 w-auto"
        />
      </div>
    </form>
  );
}
