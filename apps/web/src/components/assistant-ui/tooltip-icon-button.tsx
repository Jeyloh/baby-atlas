"use client";

import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TooltipIconButtonProps = ComponentPropsWithoutRef<typeof Button> & {
  tooltip: string;
};

export const TooltipIconButton = forwardRef<HTMLButtonElement, TooltipIconButtonProps>(
  function TooltipIconButton({ children, tooltip, className, ...rest }, ref) {
    return (
      <Button
        variant="ghost"
        size="icon"
        title={tooltip}
        aria-label={tooltip}
        type="button"
        {...rest}
        className={cn(
          "size-10 shrink-0 rounded-full text-muted-foreground hover:text-foreground md:size-9",
          className
        )}
        ref={ref}
      >
        {children}
      </Button>
    );
  }
);
