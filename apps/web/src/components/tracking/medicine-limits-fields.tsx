"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";

export interface MedicineLimitsValues {
  minIntervalHours: string;
  maxDosesPer24h: string;
  remindNextDose: boolean;
}

export const EMPTY_LIMITS: MedicineLimitsValues = {
  minIntervalHours: "",
  maxDosesPer24h: "",
  remindNextDose: false,
};

export function limitsFromMedicine(m: {
  minIntervalHours: number | null;
  maxDosesPer24h: number | null;
  remindNextDose: boolean;
}): MedicineLimitsValues {
  return {
    minIntervalHours: m.minIntervalHours === null ? "" : String(m.minIntervalHours),
    maxDosesPer24h: m.maxDosesPer24h === null ? "" : String(m.maxDosesPer24h),
    remindNextDose: m.remindNextDose,
  };
}

export interface ParsedLimits {
  minIntervalHours: number | null;
  maxDosesPer24h: number | null;
  remindNextDose: boolean;
}

export interface LimitsErrors {
  minIntervalHours?: boolean;
  maxDosesPer24h?: boolean;
}

/** Same ranges as the server: interval 0.5 to 48 hours, max 1 to 24 whole doses. */
export function parseLimits(values: MedicineLimitsValues): {
  value: ParsedLimits;
  errors: LimitsErrors;
} {
  const errors: LimitsErrors = {};

  let minIntervalHours: number | null = null;
  const intervalText = values.minIntervalHours.trim().replace(",", ".");
  if (intervalText !== "") {
    const n = Number(intervalText);
    if (Number.isFinite(n) && n >= 0.5 && n <= 48) minIntervalHours = n;
    else errors.minIntervalHours = true;
  }

  let maxDosesPer24h: number | null = null;
  const maxText = values.maxDosesPer24h.trim();
  if (maxText !== "") {
    const n = Number(maxText);
    if (Number.isInteger(n) && n >= 1 && n <= 24) maxDosesPer24h = n;
    else errors.maxDosesPer24h = true;
  }

  return {
    value: {
      minIntervalHours,
      maxDosesPer24h,
      // A reminder needs an interval to count from
      remindNextDose: values.remindNextDose && minIntervalHours !== null,
    },
    errors,
  };
}

interface MedicineLimitsFieldsProps {
  values: MedicineLimitsValues;
  onChange: (values: MedicineLimitsValues) => void;
  idPrefix: string;
}

/** Optional dose limits the parent sets for one medicine. */
export function MedicineLimitsFields({ values, onChange, idPrefix }: MedicineLimitsFieldsProps) {
  const t = useTranslations("logModal.medicine.limits");
  const { errors } = parseLimits(values);
  const hasInterval = values.minIntervalHours.trim() !== "" && !errors.minIntervalHours;

  return (
    <fieldset className="space-y-3 rounded-lg border border-border p-3">
      <legend className="px-1 text-sm font-medium">{t("title")}</legend>
      <p className="text-xs text-muted-foreground">{t("hint")}</p>

      <div className="space-y-1">
        <label htmlFor={`${idPrefix}-interval`} className="text-sm text-muted-foreground">
          {t("minInterval")}
        </label>
        <Input
          id={`${idPrefix}-interval`}
          inputMode="decimal"
          placeholder={t("minIntervalPlaceholder")}
          value={values.minIntervalHours}
          onChange={(e) => onChange({ ...values, minIntervalHours: e.target.value })}
          aria-invalid={errors.minIntervalHours || undefined}
        />
        {errors.minIntervalHours && (
          <p className="text-xs text-destructive" role="alert">
            {t("invalidInterval")}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor={`${idPrefix}-max`} className="text-sm text-muted-foreground">
          {t("maxDoses")}
        </label>
        <Input
          id={`${idPrefix}-max`}
          inputMode="numeric"
          placeholder={t("maxDosesPlaceholder")}
          value={values.maxDosesPer24h}
          onChange={(e) => onChange({ ...values, maxDosesPer24h: e.target.value })}
          aria-invalid={errors.maxDosesPer24h || undefined}
        />
        {errors.maxDosesPer24h && (
          <p className="text-xs text-destructive" role="alert">
            {t("invalidMax")}
          </p>
        )}
      </div>

      <div>
        <label className="flex min-h-12 items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="h-5 w-5 accent-[var(--primary)]"
            checked={values.remindNextDose && hasInterval}
            disabled={!hasInterval}
            onChange={(e) => onChange({ ...values, remindNextDose: e.target.checked })}
          />
          {t("remind")}
        </label>
        {!hasInterval && (
          <p className="text-xs text-muted-foreground">{t("remindNeedsInterval")}</p>
        )}
      </div>
    </fieldset>
  );
}
