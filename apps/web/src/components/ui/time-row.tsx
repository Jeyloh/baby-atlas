"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useFormatters } from "@/lib/format";

function formatTimeForInput(date: Date): string {
  return date.toISOString().slice(0, 16);
}

interface TimeRowProps {
  label: string;
  value: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
}

export function TimeRow({
  label,
  value,
  onChange,
  placeholder,
}: TimeRowProps) {
  const t = useTranslations("tracking.timeRow");
  const { dateTime } = useFormatters();
  const [editing, setEditing] = useState(false);

  return (
    <div className="flex items-center justify-between py-4 px-6 border-b border-border">
      <span className="text-muted-foreground">{label}</span>
      {editing ? (
        <input
          type="datetime-local"
          className="min-h-12 bg-transparent border-none text-right text-primary focus:outline-none"
          value={value ? formatTimeForInput(value) : ""}
          onChange={(e) => {
            onChange(e.target.value ? new Date(e.target.value) : null);
          }}
          onBlur={() => setEditing(false)}
          autoFocus
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="min-h-12 text-primary hover:underline"
        >
          {value ? dateTime(value) : (placeholder ?? t("setTime"))}
        </button>
      )}
    </div>
  );
}
