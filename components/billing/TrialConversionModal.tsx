"use client";

import React, { useState } from "react";
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
  const [isLoading, setIsLoading] = useState(false);

  const handleStartTrial = async () => {
    try {
      setIsLoading(true);

      // Track trial CTA click
      posthog?.capture("trial_cta_clicked", {
        source: "diagnostic_summary_modal",
        diagnostic_score: diagnosticScore,
        weak_areas: weakAreas,
      });

      // If not logged in, redirect to signup
      if (!user) {
        router.push("/signup?redirect=/api/billing/trial&source=diagnostic");
        return;
      }

      // Start trial via API
      const response = await fetch("/api/billing/trial", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Trial API error:", data);
        throw new Error(data.error || "Failed to start trial");
      }

      // Track successful trial start
      posthog?.capture("trial_started_from_modal", {
        trial_ends_at: data.trialEndsAt,
        subscription_id: data.subscriptionId,
      });

      // Redirect to dashboard
      router.push("/dashboard?trial=started");
    } catch (error) {
      console.error("Error starting trial:", error);
      // Could show error toast here
    } finally {
      setIsLoading(false);
    }
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
            Start your 14-day free trial and unlock your personalized study path
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
                <p className="font-medium">Unlimited Practice Questions</p>
                <p className="text-sm text-gray-600">2,000+ questions updated weekly</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <TrendingUp className="h-5 w-5 text-blue-500 mt-0.5" />
              <div>
                <p className="font-medium">Pass Rate Guarantee</p>
                <p className="text-sm text-gray-600">92% first-attempt pass rate</p>
              </div>
            </div>
          </div>

          {/* Urgency Element */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm text-amber-800">
              <strong>Limited time offer:</strong> Start today and get 30% off your first month
              after trial
            </p>
          </div>

          {/* CTAs */}
          <div className="flex flex-col gap-2">
            <Button
              onClick={handleStartTrial}
              disabled={isLoading}
              size="lg"
              tone="accent"
              fullWidth
            >
              {isLoading ? "Starting..." : "Start 14-Day Free Trial"}
            </Button>
            <Button onClick={onClose} variant="ghost" tone="neutral" size="sm" fullWidth>
              Maybe later
            </Button>
          </div>

          {/* Trust Signal */}
          <p className="text-xs text-center text-gray-500">
            No credit card required • Cancel anytime
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
