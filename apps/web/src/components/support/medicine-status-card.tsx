"use client";

import { useTranslations } from "next-intl";
import { Pill } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useMedicineDoseStatus } from "@/hooks/use-medicine-dose-status";
import { MedicineDoseLines } from "./medicine-dose-line";
import type { SupportCardProps } from "./types";

/**
 * Active medicines with a dose in the last 24 hours: when the last one was
 * given and where it stands against the limits the parent has set.
 */
export function MedicineStatusCard({ childId }: SupportCardProps) {
  const t = useTranslations("support.medicineStatus");
  const { medicines, now } = useMedicineDoseStatus(childId);

  const recent = medicines.filter((m) => m.status.dosesLast24h > 0);
  if (recent.length === 0) return null;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Pill className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <h2>{t("title")}</h2>
        </div>
        <ul className="space-y-3">
          {recent.map((m) => (
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
