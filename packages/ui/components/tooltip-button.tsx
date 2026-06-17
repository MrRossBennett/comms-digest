"use client";

import { Button } from "@repo/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";
import type { ComponentProps } from "react";

type TooltipButtonProps = ComponentProps<typeof Button> & {
  tooltip: string;
};

function TooltipButton({ tooltip, children, ...buttonProps }: TooltipButtonProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={<Button aria-label={tooltip} {...buttonProps} />}>
          {children}
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export { TooltipButton };
