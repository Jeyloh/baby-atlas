"use client";

import { useTranslations } from "next-intl";
import { useLastActivities } from "@/hooks/use-last-activities";
import { ActivityCard, useActivityDetails } from "@/components/dashboard/activity-card";
import { QuickActionBar } from "@/components/dashboard/quick-action-bar";
import { ModuleLinks } from "@/components/dashboard/module-links";
import { SupportCards } from "@/components/support/support-cards";

interface HomeViewProps {
  childId: string;
  birthDate: Date;
}

export function HomeView({ childId, birthDate }: HomeViewProps) {
  const t = useTranslations("dashboard.card");
  const tModules = useTranslations("dashboard.modules");
  const details = useActivityDetails();
  const { data: lastActivities, isLoading } = useLastActivities(childId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
            <div
              key={i}
              className="h-[76px] bg-muted animate-pulse rounded-lg"
            />
          ))}
        </div>
      </div>
    );
  }

  const {
    lastSleep,
    activeSleep,
    lastBreastfeeding,
    activeFeeding,
    lastBottle,
    lastSolids,
    lastDiaper,
    lastPumping,
    activePumping,
    lastMedicine,
    lastGrowth,
    lastTemperature,
    lastActivity,
  } = lastActivities ?? {};

  // Determine the effective "last" time for each category
  const sleepLastTime = lastSleep?.endTime ?? lastSleep?.startTime ?? null;
  const nursingLastTime =
    lastBreastfeeding?.endTime ?? lastBreastfeeding?.startTime ?? null;
  const bottleLastTime = lastBottle?.startTime ?? null;
  const solidsLastTime = lastSolids?.startTime ?? null;
  const diaperLastTime = lastDiaper?.time ?? null;
  const pumpingLastTime = lastPumping?.endTime ?? lastPumping?.startTime ?? null;
  const medicineLastTime = lastMedicine?.time ?? null;
  const growthLastTime = lastGrowth?.date ?? null;
  const temperatureLastTime = lastTemperature?.time ?? null;
  const activityLastTime = lastActivity?.endTime ?? lastActivity?.startTime ?? null;

  return (
    <div className="space-y-6">
      <QuickActionBar childId={childId} />

      <SupportCards childId={childId} birthDate={birthDate} />

      <section aria-labelledby="latest-activity-title" className="space-y-2">
        <h2 id="latest-activity-title" className="font-display text-lg font-semibold tracking-tight">
          {tModules("latestActivity")}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <ActivityCard
            category="sleep"
            childId={childId}
            lastTime={sleepLastTime}
            details={details.sleep(lastSleep ?? null)}
            isActive={!!activeSleep}
            activeLabel={t("sleeping")}
          />

          <ActivityCard
            category="nursing"
            childId={childId}
            lastTime={nursingLastTime}
            details={details.nursing(lastBreastfeeding ?? null)}
            isActive={!!activeFeeding}
            activeLabel={
              activeFeeding?.side === "LEFT"
                ? t("nursingLeft")
                : activeFeeding?.side === "RIGHT"
                  ? t("nursingRight")
                  : t("nursing")
            }
          />

          <ActivityCard
            category="bottle"
            childId={childId}
            lastTime={bottleLastTime}
            details={details.bottle(lastBottle ?? null)}
          />

          <ActivityCard
            category="solids"
            childId={childId}
            lastTime={solidsLastTime}
            details={details.solids(lastSolids ?? null)}
          />

          <ActivityCard
            category="diaper"
            childId={childId}
            lastTime={diaperLastTime}
            details={details.diaper(lastDiaper ?? null)}
          />

          <ActivityCard
            category="pumping"
            childId={childId}
            lastTime={pumpingLastTime}
            details={details.pumping(lastPumping ?? null)}
            isActive={!!activePumping}
            activeLabel={t("pumping")}
          />

          <ActivityCard
            category="medicine"
            childId={childId}
            lastTime={medicineLastTime}
            details={details.medicine(lastMedicine ?? null)}
          />

          <ActivityCard
            category="growth"
            childId={childId}
            lastTime={growthLastTime}
            details={details.growth(lastGrowth ?? null)}
          />

          <ActivityCard
            category="temperature"
            childId={childId}
            lastTime={temperatureLastTime}
            details={details.temperature(lastTemperature ?? null)}
          />

          <ActivityCard
            category="activity"
            childId={childId}
            lastTime={activityLastTime}
            details={details.activity(lastActivity ?? null)}
          />
        </div>
      </section>

      <ModuleLinks childId={childId} />
    </div>
  );
}
