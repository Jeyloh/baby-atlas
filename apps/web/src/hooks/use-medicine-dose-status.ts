"use client";

import { useEffect, useMemo, useState } from "react";
import { medicineDoseStatus, type MedicineDoseStatus } from "@baby-atlas/utils";
import { trpc } from "@/lib/trpc/provider";

export interface MedicineWithStatus {
  id: string;
  name: string;
  dosage: string;
  minIntervalHours: number | null;
  maxDosesPer24h: number | null;
  remindNextDose: boolean;
  status: MedicineDoseStatus;
}

/** Re-renders every minute so "too soon" and the next allowed time stay current. */
function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/**
 * Active medicines for a child with their dose status against the limits the
 * parent has set. `at` is when a dose would be given (default: now).
 */
export function useMedicineDoseStatus(childId: string, at?: Date | null) {
  const now = useNow();
  const query = trpc.medicine.doseStatus.useQuery({ childId });

  const medicines = useMemo<MedicineWithStatus[]>(() => {
    const reference = at ?? now;
    return (query.data ?? []).map((m) => ({
      id: m.id,
      name: m.name,
      dosage: m.dosage,
      minIntervalHours: m.minIntervalHours,
      maxDosesPer24h: m.maxDosesPer24h,
      remindNextDose: m.remindNextDose,
      status: medicineDoseStatus(m.records, m, reference),
    }));
  }, [query.data, now, at]);

  return { medicines, now, isLoading: query.isLoading };
}
