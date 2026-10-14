"use client";

import { use } from "react";
import { useTranslations } from "next-intl";
import { ChildPage } from "@/components/dashboard/child-page";
import { ReportView } from "@/components/report/report-view";

export default function ReportPage({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = use(params);
  const t = useTranslations("report");

  return (
    <ChildPage childId={childId} title={t("title")} notFoundLabel={t("notFound")}>
      {() => <ReportView childId={childId} />}
    </ChildPage>
  );
}
