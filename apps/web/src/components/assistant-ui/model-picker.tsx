"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MODEL_IDS, type ModelId } from "@/lib/chat/limits";

interface ModelPickerProps {
  value: ModelId;
  onChange: (model: ModelId) => void;
  disabled?: boolean;
}

export function ModelPicker({ value, onChange, disabled }: ModelPickerProps) {
  const t = useTranslations("chat.model");
  const labels: Record<ModelId, { name: string; hint: string }> = {
    haiku: { name: t("haiku"), hint: t("haikuHint") },
    sonnet: { name: t("sonnet"), hint: t("sonnetHint") },
    opus: { name: t("opus"), hint: t("opusHint") },
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          disabled={disabled}
          aria-label={t("label")}
          className="h-10 shrink-0 gap-1 rounded-full px-3 text-xs text-muted-foreground hover:text-foreground md:h-9"
        >
          {labels[value].name}
          <ChevronDown className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="min-w-48">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => onChange(next as ModelId)}
        >
          {MODEL_IDS.map((id) => (
            <DropdownMenuRadioItem key={id} value={id}>
              {labels[id].name}
              <span className="ms-auto ps-4 text-xs text-muted-foreground">
                {labels[id].hint}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
