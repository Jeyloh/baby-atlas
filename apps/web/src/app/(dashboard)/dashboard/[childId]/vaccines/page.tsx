"use client";

import { Suspense, use, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { nextCheckup } from "@baby-atlas/utils";
import { trpc } from "@/lib/trpc/provider";
import { ChildPage, type ToddlerChild } from "@/components/dashboard/child-page";
import { VaccineTimeline } from "@/components/toddler/vaccine-timeline";
import { buildVaccineTimeline } from "@/components/toddler/vaccine-utils";
import { CheckupTimeline } from "@/components/checkups/checkup-timeline";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function VaccinesPage({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = use(params);
  const t = useTranslations("vaccines");

  return (
    <ChildPage childId={childId} title={t("title")} notFoundLabel={t("notFound")}>
      {(child) => (
        <Suspense fallback={null}>
          <HealthContent child={child} />
        </Suspense>
      )}
    </ChildPage>
  );
}

type TabId = "checkups" | "vaccines";

function HealthContent({ child }: { child: ToddlerChild }) {
  const t = useTranslations("checkups");
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<TabId>(
    searchParams.get("tab") === "vaccines" ? "vaccines" : "checkups"
  );

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)} className="space-y-5">
      <TabsList className="grid w-full grid-cols-2" aria-label={t("tabs.label")}>
        <TabsTrigger value="checkups">{t("tabs.checkups")}</TabsTrigger>
        <TabsTrigger value="vaccines">{t("tabs.vaccines")}</TabsTrigger>
      </TabsList>
      <TabsContent value="checkups" className="mt-0">
        <CheckupsSection child={child} />
      </TabsContent>
      <TabsContent value="vaccines" className="mt-0">
        <VaccinesSection child={child} />
      </TabsContent>
    </Tabs>
  );
}

function Loading() {
  const tc = useTranslations("common");
  return (
    <div className="animate-pulse py-8 text-center text-muted-foreground" aria-busy="true">
      {tc("loading")}
    </div>
  );
}

function CheckupsSection({ child }: { child: ToddlerChild }) {
  const t = useTranslations("checkups");
  const { data, isLoading } = trpc.checkup.list.useQuery({ childId: child.id });

  if (isLoading || !data) return <Loading />;

  const done = data.filter((i) => i.status === "done").length;
  const next = nextCheckup(data);

  return (
    <div className="space-y-5">
      <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">{t("intro")}</p>
      <div>
        <p className="text-base font-medium">{t("progress", { done, total: data.length })}</p>
        {next && (
          <p className="text-sm text-muted-foreground">
            {t("next", { title: t(`items.${next.contact.key}.title`) })}
          </p>
        )}
      </div>
      <CheckupTimeline childId={child.id} items={data} />
      <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">{t("footer")}</p>
    </div>
  );
}

function VaccinesSection({ child }: { child: ToddlerChild }) {
  const t = useTranslations("vaccines");
  const { data: records, isLoading } = trpc.vaccination.list.useQuery({ childId: child.id });

  const groups = useMemo(
    () => buildVaccineTimeline(child.birthDate, records ?? []),
    [child.birthDate, records]
  );

  if (isLoading) return <Loading />;

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
