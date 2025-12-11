"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ANALYTICS_EVENTS } from "@/lib/analytics/analytics";
import { useStartBasicCheckout } from "@/hooks/useStartBasicCheckout";

export interface UpgradePromptProps {
  featureName?: string;
}

export function UpgradePrompt({ featureName }: UpgradePromptProps) {
  const pathname = usePathname();
  const posthog = usePostHog();
  const [open, setOpen] = useState(true);
  const hasTrackedView = useRef(false);
  const { startBasicCheckout } = useStartBasicCheckout();

  // Track gate_viewed on mount (only once)
  useEffect(() => {
    if (!hasTrackedView.current && posthog) {
      posthog.capture(ANALYTICS_EVENTS.GATE_VIEWED, {
        route: pathname,
        distinct_id: posthog.get_distinct_id?.() || undefined,
        feature: featureName ?? "unknown",
      });
      hasTrackedView.current = true;
    }
  }, [posthog, pathname, featureName]);

  const handlePricingClick = () => {
    if (posthog) {
      posthog.capture(ANALYTICS_EVENTS.GATE_CTA_CLICKED, {
        route: pathname,
        plan_context: "unknown",
        feature: featureName ?? "unknown",
        source: "upgrade_prompt",
      });
    }

    startBasicCheckout(`upgrade_prompt_${featureName ?? "generic"}`);
  };

  const handleDismiss = () => {
    if (posthog) {
      posthog.capture(ANALYTICS_EVENTS.GATE_DISMISSED, {
        route: pathname,
        feature: featureName ?? "unknown",
      });
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleDismiss}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            Unlock Full PMLE Practice
          </DialogTitle>
          <DialogDescription className="text-base mt-2">
            Unlock unlimited PMLE practice and expert explanations to accelerate your readiness.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 mt-4">
          <Button
            onClick={handlePricingClick}
            size="lg"
            tone="accent"
            fullWidth
          >
            Upgrade to PMLE Readiness
          </Button>
          <Button
            onClick={handleDismiss}
            variant="ghost"
            tone="neutral"
            size="sm"
            fullWidth
          >
            Dismiss
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

