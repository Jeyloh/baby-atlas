"use client";

import { use } from "react";
import { useTranslations } from "next-intl";
import { ChildPage } from "@/components/dashboard/child-page";
import { DigestLinks } from "@/components/digest/digest-links";
import { InsightsPanel } from "@/components/premium/insights-panel";
import { TrendStats } from "@/components/premium/trend-stats";

export default function InsightsPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = use(params);
  const t = useTranslations("insights");
  const tChild = useTranslations("child");

  return (
    <ChildPage childId={childId} title={t("pageTitle")} notFoundLabel={tChild("notFound")}>
      {(child) => (
        <>
          <DigestLinks childId={childId} />
          <TrendStats childId={childId} />
          <InsightsPanel childId={childId} childName={child.name} />
        </>
      )}
    </ChildPage>
  );
}
