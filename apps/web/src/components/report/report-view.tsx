"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { NORWEGIAN_VACCINE_PROGRAMME } from "@baby-atlas/utils";
import { Printer } from "lucide-react";
import { trpc } from "@/lib/trpc/provider";
import { useFormatters } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { questionsStorageKey } from "./report-utils";

type Period = "4w" | "8w" | "12w" | "sinceCheckup";

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="report-section space-y-2">
      <h2 id={id} className="text-lg font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className="text-sm">
        {label}
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

export function ReportView({ childId }: { childId: string }) {
  const t = useTranslations("report");
  const tFormat = useTranslations("format");
  const tVaccines = useTranslations("vaccines");
  const tJournal = useTranslations("journal.tags");
  const f = useFormatters();
  const [period, setPeriod] = useState<Period>("4w");

  const { data, isLoading, isError, refetch } = trpc.digest.report.useQuery({ childId, period });

  // Questions for the visit stay on this device, one note per child
  const [questions, setQuestions] = useState("");
  const [questionsLoaded, setQuestionsLoaded] = useState(false);
  useEffect(() => {
    try {
      setQuestions(localStorage.getItem(questionsStorageKey(childId)) ?? "");
    } catch {
      // Storage can be blocked; the note then lives only in this session
    }
    setQuestionsLoaded(true);
  }, [childId]);
  useEffect(() => {
    if (!questionsLoaded) return;
    try {
      const key = questionsStorageKey(childId);
      if (questions) localStorage.setItem(key, questions);
      else localStorage.removeItem(key);
    } catch {
      // See above
    }
  }, [childId, questions, questionsLoaded]);

  if (isLoading && !data) {
    return (
      <p className="animate-pulse py-8 text-center text-muted-foreground" aria-busy="true">
        {t("loading")}
      </p>
    );
  }

  if (isError || !data || !data.child) {
    return (
      <div role="alert" className="space-y-3 py-6 text-center">
        <p className="text-sm text-destructive">{t("error")}</p>
        <Button variant="outline" className="min-h-12" onClick={() => refetch()}>
          {t("retry")}
        </Button>
      </div>
    );
  }

  const { child, averages, range } = data;

  const periodOptions: { value: Period; label: string }[] = [
    { value: "4w", label: t("period.4w") },
    { value: "8w", label: t("period.8w") },
    { value: "12w", label: t("period.12w") },
    ...(data.lastCheckupDate
      ? [{ value: "sinceCheckup" as const, label: t("period.sinceCheckup") }]
      : []),
  ];

  // Age the way the helsestasjon talks about it: weeks, then months, then years
  const formatAge = () => {
    const birth = new Date(child.birthDate);
    const now = new Date();
    const days = Math.floor((now.getTime() - birth.getTime()) / 86_400_000);
    if (days < 8 * 7) return tFormat("age.weeks", { weeks: Math.max(0, Math.floor(days / 7)) });
    let months =
      (now.getFullYear() - birth.getUTCFullYear()) * 12 + now.getMonth() - birth.getUTCMonth();
    if (now.getDate() < birth.getUTCDate()) months -= 1;
    if (months < 24) return tFormat("age.months", { months });
    const years = Math.floor(months / 12);
    const rest = months % 12;
    return rest === 0
      ? tFormat("age.years", { years })
      : tFormat("age.yearsMonths", { years, months: rest });
  };

  const rangeText = t("period.range", {
    start: f.fullDate(range.from),
    end: f.fullDate(range.to),
  });
  const dateOf = (value: Date | string) => f.shortDate(value);
  const timeOf = (value: Date | string) => f.time(value);
  const num = (value: number | null, digits = 1) => (value === null ? t("growth.noValue") : f.number(value, digits));

  const averageRows: { key: string; label: string; value: string; hint?: string }[] = [];
  if (averages.sleep.totalMinutesPerDay !== null) {
    averageRows.push({
      key: "sleepTotal",
      label: t("averages.sleepTotal"),
      value: f.duration(averages.sleep.totalMinutesPerDay),
    });
    if (averages.sleep.nightMinutesPerDay !== null) {
      averageRows.push({
        key: "sleepNight",
        label: t("averages.sleepNight"),
        value: f.duration(averages.sleep.nightMinutesPerDay),
      });
    }
    if (averages.sleep.napMinutesPerDay !== null) {
      averageRows.push({
        key: "sleepNaps",
        label: t("averages.sleepNaps"),
        value: f.duration(averages.sleep.napMinutesPerDay),
        hint:
          averages.sleep.napsPerDay === null
            ? undefined
            : t("averages.napsCount", { count: f.number(averages.sleep.napsPerDay, 1) }),
      });
    }
  }
  if (averages.feeds.perDay !== null) {
    averageRows.push({
      key: "feeds",
      label: t("averages.feeds"),
      value: f.number(averages.feeds.perDay, 1),
    });
  }
  if (averages.feeds.bottleMlPerDay !== null) {
    averageRows.push({
      key: "bottle",
      label: t("averages.bottle"),
      value: f.ml(averages.feeds.bottleMlPerDay),
    });
  }
  if (averages.diapers.wetPerDay !== null) {
    averageRows.push({
      key: "wet",
      label: t("averages.wet"),
      value: f.number(averages.diapers.wetPerDay, 1),
    });
  }
  if (averages.diapers.dirtyPerDay !== null) {
    averageRows.push({
      key: "dirty",
      label: t("averages.dirty"),
      value: f.number(averages.diapers.dirtyPerDay, 1),
    });
  }
  if (averages.pumping.mlPerDay !== null) {
    averageRows.push({
      key: "pumping",
      label: t("averages.pumping"),
      value: f.ml(averages.pumping.mlPerDay),
    });
  }

  return (
    <div className="space-y-5">
      {/* Controls: hidden when printing */}
      <div className="space-y-4 print:hidden">
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
        <div role="group" aria-label={t("period.label")} className="flex flex-wrap gap-2">
          {periodOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={data.range.period === option.value}
              onClick={() => setPeriod(option.value)}
              className={cn(
                "min-h-12 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                data.range.period === option.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card hover:bg-muted"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <Button className="min-h-12 w-full sm:w-auto" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" aria-hidden />
          {t("print")}
        </Button>
      </div>

      <article className="report-page space-y-5">
        {/* Not a <header>: the print stylesheet hides those (app bar, back button) */}
        <div className="report-header space-y-1 border-b pb-3">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {t("header.title", { name: child.name })}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("header.generated", { date: f.fullDate(new Date()) })}
          </p>
        </div>

        <Section id="report-child" title={t("child.title")}>
          <dl className="divide-y rounded-lg border bg-card px-3.5">
            <Row label={t("child.name")} value={child.name} />
            <Row label={t("child.born")} value={f.fullDate(child.birthDate)} />
            <Row label={t("child.age")} value={formatAge()} />
            <Row label={t("child.period")} value={rangeText} />
          </dl>
        </Section>

        <Section id="report-growth" title={t("growth.title")}>
          {data.growth.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th scope="col" className="px-3.5 py-2 font-medium">
                      {t("growth.date")}
                    </th>
                    <th scope="col" className="px-3.5 py-2 text-right font-medium">
                      {t("growth.weight")}
                    </th>
                    <th scope="col" className="px-3.5 py-2 text-right font-medium">
                      {t("growth.height")}
                    </th>
                    <th scope="col" className="px-3.5 py-2 text-right font-medium">
                      {t("growth.head")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y tabular-nums">
                  {data.growth.map((row) => (
                    <tr key={row.date}>
                      <th scope="row" className="px-3.5 py-2 text-left font-normal">
                        {f.fullDate(row.date)}
                      </th>
                      <td className="px-3.5 py-2 text-right">{num(row.weightKg, 3)}</td>
                      <td className="px-3.5 py-2 text-right">{num(row.heightCm)}</td>
                      <td className="px-3.5 py-2 text-right">{num(row.headCircumferenceCm)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section id="report-averages" title={t("averages.title")}>
          {averageRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">{t("averages.hint")}</p>
              <dl className="divide-y rounded-lg border bg-card px-3.5">
                {averageRows.map((row) => (
                  <Row key={row.key} label={row.label} value={row.value} hint={row.hint} />
                ))}
              </dl>
              <p className="text-xs text-muted-foreground">
                {t("averages.loggedDays", {
                  logged: Math.max(
                    averages.sleep.loggedDays,
                    averages.feeds.loggedDays,
                    averages.diapers.loggedDays
                  ),
                  total: averages.days,
                })}
              </p>
            </>
          )}
        </Section>

        <Section id="report-medicines" title={t("medicines.title")}>
          {data.medicines.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <ul className="space-y-2">
              {data.medicines.map((medicine) => (
                <li key={medicine.id} className="space-y-1 rounded-lg border bg-card p-3.5">
                  <p className="font-medium">
                    {medicine.name}
                    {!medicine.isActive && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {t("medicines.inactive")}
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t("medicines.regular", { dosage: medicine.dosage })}
                    {medicine.frequency ? `, ${medicine.frequency}` : ""}
                  </p>
                  <p className="text-sm">
                    {t("medicines.given", { count: medicine.given.length })}
                    {medicine.skipped > 0 && (
                      <span className="text-muted-foreground">
                        {" · "}
                        {t("medicines.skipped", { count: medicine.skipped })}
                      </span>
                    )}
                  </p>
                  {medicine.given.length > 0 && (
                    <ul className="text-xs text-muted-foreground tabular-nums">
                      {medicine.given.map((dose, index) => (
                        <li key={index}>
                          {dose.dosageGiven
                            ? t("medicines.doseWithAmount", {
                                date: dateOf(dose.time),
                                time: timeOf(dose.time),
                                amount: dose.dosageGiven,
                              })
                            : t("medicines.dose", {
                                date: dateOf(dose.time),
                                time: timeOf(dose.time),
                              })}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section id="report-temperatures" title={t("temperatures.title")}>
          {data.temperatures.readings.length === 0 || !data.temperatures.highest ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <div className="space-y-1 rounded-lg border bg-card p-3.5">
              <p className="font-medium">
                {t("temperatures.highest", {
                  value: f.temperatureC(data.temperatures.highest.celsius),
                  date: dateOf(data.temperatures.highest.time),
                  time: timeOf(data.temperatures.highest.time),
                })}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("temperatures.count", { count: data.temperatures.readings.length })}
              </p>
              <ul className="text-xs text-muted-foreground tabular-nums">
                {data.temperatures.readings.map((reading, index) => (
                  <li key={index}>
                    {t("temperatures.reading", {
                      date: dateOf(reading.time),
                      time: timeOf(reading.time),
                      value: f.temperatureC(reading.celsius),
                    })}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>

        <Section id="report-vaccines" title={t("vaccines.title")}>
          {data.vaccinations.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <ul className="divide-y rounded-lg border bg-card px-3.5">
              {data.vaccinations.map((record) => {
                const dose = NORWEGIAN_VACCINE_PROGRAMME.find((d) => d.key === record.vaccineKey);
                return (
                  <li key={record.vaccineKey} className="flex items-baseline justify-between gap-3 py-2">
                    <span className="text-sm">
                      {dose
                        ? `${tVaccines(`names.${dose.vaccine}`)}, ${t("vaccines.dose", { dose: dose.dose })}`
                        : record.vaccineKey}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {t("vaccines.given", { date: f.fullDate(record.givenAt) })}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section id="report-journal" title={t("journal.title")}>
          {data.journal.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <ul className="space-y-2">
              {data.journal.map((entry) => (
                <li key={entry.id} className="space-y-1 rounded-lg border bg-card p-3.5">
                  <p className="text-xs text-muted-foreground">
                    {f.fullDate(entry.date)}
                    {" · "}
                    {entry.tags
                      .filter((tag) => tag === "CLINIC" || tag === "SICKNESS")
                      .map((tag) => tJournal(tag))
                      .join(", ")}
                  </p>
                  <p className="whitespace-pre-wrap text-sm">{entry.text}</p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section id="report-questions" title={t("questions.title")}>
          <div className="space-y-2 print:hidden">
            <Label htmlFor="report-questions-input" className="text-xs font-normal text-muted-foreground">
              {t("questions.hint")}
            </Label>
            <Textarea
              id="report-questions-input"
              value={questions}
              onChange={(event) => setQuestions(event.target.value)}
              placeholder={t("questions.placeholder")}
              rows={5}
            />
          </div>
          {/* A textarea does not print its full text, so print a plain copy */}
          <div className="hidden min-h-24 whitespace-pre-wrap rounded-lg border p-3.5 text-sm print:block">
            {questions}
          </div>
        </Section>

        <p className="text-xs text-muted-foreground">{t("footer")}</p>
      </article>
    </div>
  );
}
