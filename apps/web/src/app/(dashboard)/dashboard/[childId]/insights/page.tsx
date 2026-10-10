"use client";

import { use } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { trpc } from "@/lib/trpc/provider";
import { Button } from "@/components/ui/button";
import { InsightsPanel } from "@/components/premium/insights-panel";
import { TrendStats } from "@/components/premium/trend-stats";

export default function InsightsPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = use(params);
  const t = useTranslations("insights");

  const { data: child } = trpc.child.get.useQuery({ id: childId });

  if (!child) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="animate-pulse text-muted-foreground">...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon-sm">
          <Link href={`/dashboard/${childId}`}>
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">{t("back")}</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-lg font-semibold">{t("pageTitle")}</h1>
          <p className="text-sm text-muted-foreground">{child.name}</p>
        </div>
      </div>

      <TrendStats childId={childId} />
      <InsightsPanel childId={childId} childName={child.name} />
    </div>
  );
}
