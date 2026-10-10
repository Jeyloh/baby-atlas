"use client";

import { use, useMemo } from "react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc/provider";
import { ChildPage, type ToddlerChild } from "@/components/dashboard/child-page";
import { VaccineTimeline } from "@/components/toddler/vaccine-timeline";
import { buildVaccineTimeline } from "@/components/toddler/vaccine-utils";

export default function VaccinesPage({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = use(params);
  const t = useTranslations("vaccines");

  return (
    <ChildPage childId={childId} title={t("title")} notFoundLabel={t("notFound")}>
      {(child) => <VaccinesContent child={child} />}
    </ChildPage>
  );
}

function VaccinesContent({ child }: { child: ToddlerChild }) {
  const t = useTranslations("vaccines");
  const tc = useTranslations("common");
  const { data: records, isLoading } = trpc.vaccination.list.useQuery({ childId: child.id });

  const groups = useMemo(
    () => buildVaccineTimeline(child.birthDate, records ?? []),
    [child.birthDate, records]
  );

  if (isLoading) {
    return (
      <div className="animate-pulse py-8 text-center text-muted-foreground" aria-busy="true">
        {tc("loading")}
      </div>
    );
  }

  const total = groups.reduce((sum, g) => sum + g.doses.length, 0);
  const given = groups.reduce((sum, g) => sum + g.doses.filter((d) => d.givenAt).length, 0);

  return (
    <div className="space-y-5">
      <p className="text-base font-medium">{t("progress", { given, total })}</p>
      <VaccineTimeline childId={child.id} groups={groups} />
      <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">{t("footer")}</p>
    </div>
  );
}
