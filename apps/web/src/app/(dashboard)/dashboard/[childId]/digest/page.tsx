"use client";

import { use } from "react";
import { useTranslations } from "next-intl";
import { ChildPage } from "@/components/dashboard/child-page";
import { DigestView } from "@/components/digest/digest-view";
import { parseWeekParam } from "@/components/digest/digest-utils";

export default function DigestPage({
  params,
  searchParams,
}: {
  params: Promise<{ childId: string }>;
  searchParams: Promise<{ week?: string | string[] }>;
}) {
  const { childId } = use(params);
  const { week } = use(searchParams);
  const t = useTranslations("digest");

  return (
    <ChildPage childId={childId} title={t("title")} notFoundLabel={t("notFound")}>
      {() => <DigestView childId={childId} week={parseWeekParam(week)} />}
    </ChildPage>
  );
}
