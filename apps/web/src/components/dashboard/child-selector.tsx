"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useFormatters } from "@/lib/format";
import { ChevronDown, Plus, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Child {
  id: string;
  name: string;
  birthDate: Date | string;
}

interface ChildSelectorProps {
  currentChild: Child;
  allChildren: Child[];
  householdId: string;
}

export function ChildSelector({
  currentChild,
  allChildren,
  householdId,
}: ChildSelectorProps) {
  const router = useRouter();
  const t = useTranslations("dashboard.childSelector");
  const tFormat = useTranslations("format");
  const { fullDate } = useFormatters();

  // Age the way the helsestasjon talks about it: weeks, then months, then years
  const formatAge = (birthDate: Date | string) => {
    const birth = new Date(birthDate);
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

  const handleChildSelect = (childId: string) => {
    router.push(`/dashboard/${childId}`);
  };

  const handleAddChild = () => {
    router.push(`/dashboard/${householdId}/child/new`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="-ml-2 flex min-h-12 min-w-0 items-center gap-1 rounded-xl px-2 py-1 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <div className="min-w-0 text-left">
          <h1 className="truncate font-display text-3xl font-semibold leading-tight tracking-tight">
            {currentChild.name}
          </h1>
          <p className="text-sm text-muted-foreground">{formatAge(currentChild.birthDate)}</p>
        </div>
        <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {allChildren.map((child) => (
          <DropdownMenuItem
            key={child.id}
            onClick={() => handleChildSelect(child.id)}
            className="flex items-center justify-between cursor-pointer"
          >
            <div>
              <p className="font-medium">{child.name}</p>
              <p className="text-xs text-muted-foreground">
                {tFormat("bornOn", { date: fullDate(child.birthDate) })}
              </p>
            </div>
            {child.id === currentChild.id && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleAddChild}
          className="cursor-pointer"
        >
          <Plus className="h-4 w-4 mr-2" />
          {t("addChild")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
