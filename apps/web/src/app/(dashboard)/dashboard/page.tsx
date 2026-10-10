"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc/provider";
import { Button } from "@/components/ui/button";
import { Plus, Baby, Home } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const router = useRouter();
  const t = useTranslations("household");
  const tCommon = useTranslations("common");
  const { data: households, isLoading } = trpc.household.list.useQuery();

  const household = households?.[0];
  const children = household?.children || [];
  const firstChild = children[0];

  // Auto-redirect to first child's dashboard
  useEffect(() => {
    if (!isLoading && firstChild) {
      router.replace(`/dashboard/${firstChild.id}`);
    }
  }, [isLoading, firstChild, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-muted-foreground">{tCommon("loading")}</div>
      </div>
    );
  }

  // No household - show create household
  if (!households?.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Home className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-2xl font-semibold">{t("welcome")}</h2>
        <p className="text-muted-foreground text-center max-w-md">{t("createPrompt")}</p>
        <Button asChild>
          <Link href="/dashboard/household/new">
            <Plus className="mr-2 h-4 w-4" />
            {t("create")}
          </Link>
        </Button>
      </div>
    );
  }

  // No children - show add child
  if (!children.length) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{household?.name}</h1>
          <Button asChild variant="outline">
            <Link href="/dashboard/household/settings">{t("settings")}</Link>
          </Button>
        </div>

        <div className="flex flex-col items-center justify-center min-h-[300px] space-y-4">
          <Baby className="h-16 w-16 text-muted-foreground" />
          <h2 className="text-xl font-semibold">{t("addFirstChild")}</h2>
          <p className="text-muted-foreground text-center max-w-md">
            {t("addFirstChildDescription")}
          </p>
          <Button asChild>
            <Link href={`/dashboard/${household?.id}/child/new`}>
              <Plus className="mr-2 h-4 w-4" />
              {t("addChild")}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // Has children - show loading while redirecting
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-pulse text-muted-foreground">{tCommon("loading")}</div>
    </div>
  );
}
