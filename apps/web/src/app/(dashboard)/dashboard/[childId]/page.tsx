"use client";

import { use, useState } from "react";
import { trpc } from "@/lib/trpc/provider";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HomeView } from "@/components/dashboard/home-view";
import { ReportsView } from "@/components/dashboard/reports-view";
import { ChildSelector } from "@/components/dashboard/child-selector";
import { Chat } from "@/components/chat";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Settings, Home, BarChart3, MessageCircle, UserPlus } from "lucide-react";

export default function ChildDashboardPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = use(params);
  const t = useTranslations("child");
  const tCommon = useTranslations("common");
  const [activeTab, setActiveTab] = useState("home");
  const { data: child, isLoading: childLoading } = trpc.child.get.useQuery({ id: childId });

  // Get all children in household for the selector
  const { data: allChildren, isLoading: childrenLoading } = trpc.child.list.useQuery(
    { householdId: child?.household?.id ?? "" },
    { enabled: !!child?.household?.id }
  );

  const isLoading = childLoading || (child?.household?.id && childrenLoading);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-muted-foreground">{tCommon("loading")}</div>
      </div>
    );
  }

  if (!child) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <p className="text-muted-foreground">{t("notFound")}</p>
        <Button asChild>
          <Link href="/dashboard">{t("backToDashboard")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <ChildSelector
          currentChild={child}
          allChildren={allChildren ?? [child]}
          householdId={child.household?.id ?? ""}
        />
        <div className="-mr-2 flex shrink-0">
          <Button asChild variant="ghost" size="icon" className="rounded-full">
            <Link
              href={`/dashboard/household/settings?householdId=${child.household?.id ?? ""}&invite=1`}
              aria-label={t("inviteCaregiver")}
            >
              <UserPlus className="h-5 w-5" />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="icon" className="rounded-full">
            <Link href={`/dashboard/${childId}/settings`} aria-label={t("settings")}>
              <Settings className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Main tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="home" className="gap-2">
            <Home className="h-4 w-4" />
            {t("tabs.home")}
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            {t("tabs.reports")}
          </TabsTrigger>
          <TabsTrigger value="chat" className="gap-2">
            <MessageCircle className="h-4 w-4" />
            {t("tabs.chat")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="home" className="mt-4">
          <HomeView childId={childId} birthDate={child.birthDate} />
        </TabsContent>

        <TabsContent value="reports" className="mt-4">
          <ReportsView childId={childId} />
        </TabsContent>

        <TabsContent value="chat" className="mt-4">
          <div className="h-[calc(100dvh-16.5rem)] min-h-[26rem] overflow-hidden rounded-lg border">
            <Chat childId={childId} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
