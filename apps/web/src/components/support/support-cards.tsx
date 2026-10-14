"use client";

import { HandoverCard } from "./handover-card";
import { HealthHintsCard } from "./health-hints-card";
import { MedicineStatusCard } from "./medicine-status-card";
import { TimerFixCard } from "./timer-fix-card";
import type { SupportCardProps } from "./types";
import { WeeklyTipCard } from "./weekly-tip-card";
import { WellbeingCard } from "./wellbeing-card";
import { WhatsNextCard } from "./whats-next-card";

/**
 * The cards under the quick actions that help the parents: a forgotten timer,
 * health hints, what comes next, medicine status, handover, the weekly tip
 * and wellbeing. Each card renders nothing when it has nothing to say.
 */
export function SupportCards(props: SupportCardProps) {
  return (
    <div className="space-y-3 empty:hidden">
      <TimerFixCard {...props} />
      <HealthHintsCard {...props} />
      <WhatsNextCard {...props} />
      <MedicineStatusCard {...props} />
      <HandoverCard {...props} />
      <WeeklyTipCard {...props} />
      <WellbeingCard {...props} />
    </div>
  );
}
