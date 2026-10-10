"use client";

import { use } from "react";
import { useTranslations } from "next-intl";
import { ChildPage } from "@/components/dashboard/child-page";
import { JournalView } from "@/components/journal/journal-view";

export default function JournalPage({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = use(params);
  const t = useTranslations("journal");

  return (
    <ChildPage childId={childId} title={t("title")} notFoundLabel={t("notFound")}>
      {(child) => <JournalView child={child} />}
    </ChildPage>
  );
}
