"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Sparkles, AlertCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PricingCardProps {
  tier: {
    id: string;
    name: string;
    description: string;
    monthlyPrice: number;
    threeMonthPrice: number;
    monthlyPriceId?: string;
    threeMonthPriceId?: string;
    features: string[];
    highlighted?: string[];
    recommended?: boolean;
    savingsPercentage?: number;
  };
  billingInterval: "monthly" | "three_month";
  onCheckout: (priceId: string, tierName: string) => void;
  loading?: boolean;
  loadingId?: string | null;
}

export function PricingCard({
  tier,
  billingInterval,
  onCheckout,
  loading = false,
  loadingId = null,
}: PricingCardProps) {
  const router = useRouter();
  const price = billingInterval === "monthly" ? tier.monthlyPrice : tier.threeMonthPrice;
  const priceId = billingInterval === "monthly" ? tier.monthlyPriceId : tier.threeMonthPriceId;
  const checkoutPriceId = priceId ?? `${tier.id}-${billingInterval}`;
  const isCheckoutConfigured = Boolean(priceId);
  const isLoading = loading && loadingId === priceId;
  const monthlyEquivalent =
    billingInterval === "three_month" ? Math.round((tier.threeMonthPrice / 3) * 100) / 100 : null;

  const handleButtonClick = () => {
    if (!isCheckoutConfigured) {
      // Fallback: redirect to signup if checkout isn't configured
      router.push("/signup?redirect=/pricing");
      return;
    }
    onCheckout(checkoutPriceId, tier.name);
  };

  return (
    <Card
      data-recommended={tier.recommended ? "true" : undefined}
      variant={tier.recommended ? "elevated" : "default"}
      size="lg"
      className={cn(
        "relative w-full",
        tier.recommended
          ? "border-accent/50 ring-2 ring-accent/25"
          : "border-border/60",
        billingInterval === "three_month" && tier.savingsPercentage ? "pt-6" : ""
      )}
    >
      {tier.recommended ? (
        <div className="absolute inset-x-0 -top-4 flex justify-center">
          <Badge
            tone="accent"
            variant="solid"
            icon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
            className="shadow-lg"
          >
            Most popular
          </Badge>
        </div>
      ) : null}

      {billingInterval === "three_month" && tier.savingsPercentage ? (
        <div className={cn(
          "absolute right-6",
          tier.recommended ? "top-12" : "top-6"
        )}>
          <Badge
            tone="success"
            variant="soft"
            size="sm"
            className="shadow-sm bg-emerald-700 text-white"
          >
            Save {tier.savingsPercentage}%
          </Badge>
        </div>
      ) : null}

      <CardHeader className="gap-2">
        <CardTitle className="text-3xl font-semibold text-foreground">
          {tier.name}
        </CardTitle>
        <CardDescription>{tier.description}</CardDescription>
      </CardHeader>

      <CardContent className="gap-6">
        <div className="space-y-3">
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-semibold tracking-tight text-foreground">
              ${price}
            </span>
            <span className="text-lg text-muted-foreground">
              /{billingInterval === "monthly" ? "month" : "3 months"}
            </span>
          </div>
          {monthlyEquivalent ? (
            <p className="text-sm text-muted-foreground">
              That&apos;s only ${monthlyEquivalent}/month
            </p>
          ) : null}
        </div>

        {tier.highlighted && tier.highlighted.length > 0 ? (
          <div className="space-y-2 rounded-lg border border-accent/30 bg-accent/5 p-4 md:p-6">
            {tier.highlighted.map((feature) => (
              <div key={feature} className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 flex-shrink-0 text-accent" aria-hidden="true" />
                <span className="text-sm font-medium text-foreground">{feature}</span>
              </div>
            ))}
          </div>
        ) : null}

        <ul className="space-y-3">
          {tier.features.map((feature) => (
            <li key={feature} className="flex items-start gap-3 text-sm text-muted-foreground">
              <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-success" aria-hidden="true" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>

      <CardFooter className="flex-col items-stretch gap-3 border-0 pt-0">
        {isCheckoutConfigured ? (
          <Button
            fullWidth
            tone={tier.recommended ? "accent" : "neutral"}
            variant="solid"
            size="lg"
            loading={isLoading}
            disabled={isLoading}
            onClick={handleButtonClick}
          >
            Start Preparing
          </Button>
        ) : (
          <>
            <Button
              fullWidth
              tone={tier.recommended ? "accent" : "neutral"}
              variant="solid"
              size="lg"
              onClick={handleButtonClick}
            >
              Get Started
            </Button>
            <div className="flex items-start gap-2 rounded-md bg-yellow-50 p-3 border border-yellow-200">
              <AlertCircle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-xs text-yellow-800">
                Payment processing is being set up. Click to create your account and we&apos;ll notify you when checkout is ready.
              </p>
            </div>
          </>
        )}

      </CardFooter>
    </Card>
  );
}
