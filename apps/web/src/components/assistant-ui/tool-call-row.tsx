"use client";

import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import { Check, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";

function toMessageKey(toolName: string) {
  return toolName
    .replace(/^mcp__baby_atlas__/, "")
    .split("-")
    .map((word, i) => (i === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join("");
}

export const ToolCallRow: ToolCallMessagePartComponent = ({ toolName, result, isError }) => {
  const t = useTranslations("chat");
  const key = `tools.${toMessageKey(toolName)}` as Parameters<typeof t>[0];
  const label = t.has(key) ? t(key) : toolName;

  return (
    <div className="my-1 flex w-fit max-w-full items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
      {isError ? (
        <X className="size-3.5 shrink-0 text-destructive" />
      ) : result !== undefined ? (
        <Check className="size-3.5 shrink-0 text-success" />
      ) : (
        <Loader2 className="size-3.5 shrink-0 animate-spin" />
      )}
      <span className="truncate">{label}</span>
    </div>
  );
};
