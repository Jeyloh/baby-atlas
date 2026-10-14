"use client";

import { useEffect, useMemo, useState } from "react";
import {
  medicineDoseStatus,
  type MedicineDoseRecord,
  type MedicineDoseStatus,
} from "@baby-atlas/utils";
import { trpc } from "@/lib/trpc/provider";
import { sharedFreshness } from "@/lib/shared-freshness";

export interface MedicineWithStatus {
  id: string;
  name: string;
  dosage: string;
  minIntervalHours: number | null;
  maxDosesPer24h: number | null;
  remindNextDose: boolean;
  records: MedicineDoseRecord[];
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
 * parent has set, as of now.
 */
export function useMedicineDoseStatus(childId: string) {
  const now = useNow();
  const query = trpc.medicine.doseStatus.useQuery({ childId }, sharedFreshness);

  const medicines = useMemo<MedicineWithStatus[]>(() => {
    return (query.data ?? []).map((m) => ({
      id: m.id,
      name: m.name,
      dosage: m.dosage,
      minIntervalHours: m.minIntervalHours,
      maxDosesPer24h: m.maxDosesPer24h,
      remindNextDose: m.remindNextDose,
      records: m.records,
      status: medicineDoseStatus(m.records, m, now),
    }));
  }, [query.data, now]);

  return { medicines, now, isLoading: query.isLoading };
}
