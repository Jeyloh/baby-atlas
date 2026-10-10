"use client";

import { use, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { SpeechCategory } from "@baby-atlas/schemas";
import { trpc } from "@/lib/trpc/provider";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChildPage } from "@/components/dashboard/child-page";
import { SpeechQuickAdd } from "@/components/toddler/speech-quick-add";
import { SpeechWordList } from "@/components/toddler/speech-word-list";
import { VocabularyChart } from "@/components/toddler/vocabulary-chart";
import {
  SPEECH_CATEGORIES,
  countByCategory,
  cumulativeVocabulary,
  filterByCategory,
  sortNewestFirst,
} from "@/components/toddler/speech-utils";

export default function SpeechPage({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = use(params);
  const t = useTranslations("speech");

  return (
    <ChildPage childId={childId} title={t("title")} notFoundLabel={t("notFound")}>
      {() => <SpeechContent childId={childId} />}
    </ChildPage>
  );
}

function SpeechContent({ childId }: { childId: string }) {
  const t = useTranslations("speech");
  const tc = useTranslations("common");
  const { data: words, isLoading } = trpc.speech.list.useQuery({ childId });
  const [filter, setFilter] = useState<SpeechCategory | "ALL">("ALL");

  const sorted = useMemo(() => sortNewestFirst(words ?? []), [words]);
  const visible = useMemo(() => filterByCategory(sorted, filter), [sorted, filter]);
  const series = useMemo(() => cumulativeVocabulary(words ?? []), [words]);
  const counts = useMemo(() => countByCategory(words ?? []), [words]);
  const total = words?.length ?? 0;

  const filters: { value: SpeechCategory | "ALL"; label: string; count: number }[] = [
    { value: "ALL", label: t("filterAll"), count: total },
    ...SPEECH_CATEGORIES.map((c) => ({ value: c, label: t(`categories.${c}`), count: counts[c] })),
  ];

  return (
    <div className="space-y-5">
      <SpeechQuickAdd childId={childId} />

      {isLoading ? (
        <div className="animate-pulse py-8 text-center text-muted-foreground" aria-busy="true">
          {tc("loading")}
        </div>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-3xl font-bold">{t("total", { count: total })}</CardTitle>
              <p className="text-sm text-muted-foreground">{t("totalHint")}</p>
            </CardHeader>
            <CardContent>
              <p className="sr-only">{t("chart.title")}</p>
              <VocabularyChart points={series} />
            </CardContent>
          </Card>

          {total === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
              {t("empty")}
            </p>
          ) : (
            <section className="space-y-3">
              <div role="group" className="flex flex-wrap gap-2">
                {filters.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    aria-pressed={filter === f.value}
                    onClick={() => setFilter(f.value)}
                    className={cn(
                      "min-h-12 rounded-full border px-4 text-sm font-medium transition-colors",
                      filter === f.value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-card hover:bg-muted"
                    )}
                  >
                    {f.label} ({f.count})
                  </button>
                ))}
              </div>
              {visible.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">{t("emptyFiltered")}</p>
              ) : (
                <SpeechWordList childId={childId} words={visible} />
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
