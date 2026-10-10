"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { VocabularyPoint } from "./speech-utils";

const WIDTH = 320;
const HEIGHT = 140;
const PAD = { top: 12, right: 12, bottom: 24, left: 28 };

interface VocabularyChartProps {
  points: VocabularyPoint[];
}

function dayNumber(date: string): number {
  return Date.parse(`${date}T00:00:00Z`) / 86_400_000;
}

export function VocabularyChart({ points }: VocabularyChartProps) {
  const t = useTranslations("speech.chart");
  const format = useFormatter();

  if (points.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>;
  }

  const total = points[points.length - 1]!.count;
  const first = dayNumber(points[0]!.date);
  const last = dayNumber(points[points.length - 1]!.date);
  const span = Math.max(last - first, 1);
  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;

  const x = (date: string) =>
    points.length === 1 ? PAD.left + innerW : PAD.left + ((dayNumber(date) - first) / span) * innerW;
  const y = (count: number) => PAD.top + innerH - (count / total) * innerH;

  const stepped = points.flatMap((p, i) => {
    const prev = points[i - 1];
    return prev ? [`H${x(p.date)}`, `V${y(p.count)}`] : [`M${PAD.left},${y(0)}`, `H${x(p.date)}`, `V${y(p.count)}`];
  });
  const line = stepped.join(" ");
  const area = `${line} V${y(0)} H${PAD.left} Z`;
  const dateLabel = (date: string) =>
    format.dateTime(new Date(`${date}T00:00:00Z`), {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={t("label", { count: total })}
      className="h-auto w-full"
    >
      <line
        x1={PAD.left}
        x2={WIDTH - PAD.right}
        y1={y(0)}
        y2={y(0)}
        className="stroke-border"
      />
      <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(total)} y2={y(total)} className="stroke-border" strokeDasharray="3 3" />
      <text x={PAD.left - 6} y={y(total) + 4} textAnchor="end" className="fill-muted-foreground text-[10px]">
        {total}
      </text>
      <text x={PAD.left - 6} y={y(0) + 4} textAnchor="end" className="fill-muted-foreground text-[10px]">
        0
      </text>
      <path d={area} className="fill-primary/15" />
      <path d={line} fill="none" strokeWidth={2} strokeLinejoin="round" className="stroke-primary" />
      <text x={PAD.left} y={HEIGHT - 6} textAnchor="start" className="fill-muted-foreground text-[10px]">
        {dateLabel(points[0]!.date)}
      </text>
      {points.length > 1 && (
        <text x={WIDTH - PAD.right} y={HEIGHT - 6} textAnchor="end" className="fill-muted-foreground text-[10px]">
          {dateLabel(points[points.length - 1]!.date)}
        </text>
      )}
    </svg>
  );
}
