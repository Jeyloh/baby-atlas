"use client";

import { useTranslations } from "next-intl";
import { Pill } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useLastActivities } from "@/hooks/use-last-activities";
import { useMedicineDoseStatus, type MedicineWithStatus } from "@/hooks/use-medicine-dose-status";
import { MedicineDoseLines } from "./medicine-dose-line";
import { HIDDEN_CARD, type SupportCardProps, type SupportCardState } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Active medicines with a dose in the last 24 hours: when the last one was
 * given and where it stands against the limits the parent has set. The dose
 * status is only fetched when the home screen's latest medicine record is
 * from the last 24 hours, because the card shows nothing otherwise.
 */
export function useMedicineStatusCard({ childId }: SupportCardProps): SupportCardState {
  const { data: last } = useLastActivities(childId);
  const lastDose = last?.lastMedicine?.time;
  const hasRecentDose = !!lastDose && Date.now() - lastDose.getTime() < DAY_MS;
  const { medicines, now } = useMedicineDoseStatus(childId, { enabled: hasRecentDose });

  const recent = medicines.filter((m) => m.status.dosesLast24h > 0);
  if (recent.length === 0) return HIDDEN_CARD;
  return { visible: true, urgent: false, element: <MedicineStatus medicines={recent} now={now} /> };
}

export function MedicineStatusCard(props: SupportCardProps) {
  return useMedicineStatusCard(props).element;
}

function MedicineStatus({ medicines, now }: { medicines: MedicineWithStatus[]; now: Date }) {
  const t = useTranslations("support.medicineStatus");
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Pill className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <h2>{t("title")}</h2>
        </div>
        <ul className="space-y-3">
          {medicines.map((m) => (
            <li key={m.id} className="space-y-0.5">
              <p className="text-sm font-medium">{m.name}</p>
              <MedicineDoseLines status={m.status} maxDosesPer24h={m.maxDosesPer24h} now={now} />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
