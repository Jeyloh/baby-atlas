"use client";

import { use, useMemo } from "react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc/provider";
import { ChildPage, type ToddlerChild } from "@/components/dashboard/child-page";
import { PottyHistory } from "@/components/toddler/potty-history";
import { PottyLogForm } from "@/components/toddler/potty-log-form";
import { ReadinessSummary } from "@/components/toddler/readiness-summary";
import { ageInMonths, summarizeReadiness } from "@/components/toddler/potty-utils";

export default function PottyPage({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = use(params);
  const t = useTranslations("potty");

  return (
    <ChildPage childId={childId} title={t("title")} notFoundLabel={t("notFound")}>
      {(child) => <PottyContent child={child} />}
    </ChildPage>
  );
}

function PottyContent({ child }: { child: ToddlerChild }) {
  const t = useTranslations("potty");
  const tc = useTranslations("common");
  const { data: logs, isLoading } = trpc.potty.list.useQuery({ childId: child.id });

  const summary = useMemo(() => summarizeReadiness(logs ?? []), [logs]);
  const months = ageInMonths(child.birthDate);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="text-base">{t("intro")}</p>
        {months < 18 && (
          <p className="rounded-xl bg-muted p-4 text-sm">
            {t("youngNote", { name: child.name, months })}
          </p>
        )}
      </div>

      <PottyLogForm childId={child.id} />

      {isLoading ? (
        <div className="animate-pulse py-8 text-center text-muted-foreground" aria-busy="true">
          {tc("loading")}
        </div>
      ) : (
        <>
          <ReadinessSummary summary={summary} />
          <PottyHistory childId={child.id} logs={logs ?? []} />
        </>
      )}
    </div>
  );
}
