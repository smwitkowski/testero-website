"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { usePostHog } from "posthog-js/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, Zap, TrendingUp } from "lucide-react";
import { useStartBasicCheckout } from "@/hooks/useStartBasicCheckout";

interface TrialConversionModalProps {
  open: boolean;
  onClose: () => void;
  diagnosticScore?: number;
  weakAreas?: string[];
}

export function TrialConversionModal({
  open,
  onClose,
  diagnosticScore = 0,
  weakAreas = [],
}: TrialConversionModalProps) {
  const router = useRouter();
  const { user } = useAuth();
  const posthog = usePostHog();
  const { startBasicCheckout } = useStartBasicCheckout();

  const handleUpgrade = () => {
    // Track upgrade CTA click
    posthog?.capture("upgrade_cta_clicked", {
      source: "diagnostic_summary_modal",
      diagnostic_score: diagnosticScore,
      weak_areas: weakAreas,
    });

    // If not logged in, redirect to signup with pricing redirect
    if (!user) {
      router.push("/signup?redirect=/pricing&source=diagnostic");
      return;
    }

    // Start checkout flow
    startBasicCheckout("diagnostic_summary_modal");
  };

  // Personalized headline based on score
  const getHeadline = () => {
    if (diagnosticScore < 40) {
      return "Build a Strong Foundation";
    } else if (diagnosticScore < 70) {
      return "Bridge the Gap to Success";
    } else {
      return "Perfect Your Performance";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">{getHeadline()}</DialogTitle>
          <DialogDescription className="text-base mt-2">
            Upgrade now to unlock your personalized study path
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Value Props */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium">Personalized Study Plan</p>
                <p className="text-sm text-gray-600">
                  AI-powered path based on your diagnostic results
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Zap className="h-5 w-5 text-yellow-500 mt-0.5" />
              <div>
                <p className="font-medium">Unlimited Targeted Practice</p>
                <p className="text-sm text-gray-600">Blueprint-aligned PMLE practice focused on your weakest domains</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <TrendingUp className="h-5 w-5 text-blue-500 mt-0.5" />
              <div>
                <p className="font-medium">Step-by-Step Explanations</p>
                <p className="text-sm text-gray-600">Explanations that help you understand concepts deeply</p>
              </div>
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-col gap-2">
            <Button
              onClick={handleUpgrade}
              size="lg"
              tone="accent"
              fullWidth
            >
              Upgrade to PMLE Readiness
            </Button>
            <Button onClick={onClose} variant="ghost" tone="neutral" size="sm" fullWidth>
              Maybe later
            </Button>
          </div>

          {/* Trust Signal */}
          <p className="text-xs text-center text-gray-500">
            Cancel anytime • 7-day money-back guarantee
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
