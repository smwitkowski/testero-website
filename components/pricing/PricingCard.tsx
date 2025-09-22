"use client";

import React from "react";
import { CheckCircle, Sparkles, TrendingUp } from "lucide-react";

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
    annualPrice: number;
    monthlyPriceId?: string;
    annualPriceId?: string;
    aiCredits: number;
    features: string[];
    highlighted?: string[];
    recommended?: boolean;
    savingsPercentage?: number;
  };
  billingInterval: "monthly" | "annual";
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
  const price = billingInterval === "monthly" ? tier.monthlyPrice : tier.annualPrice;
  const priceId = billingInterval === "monthly" ? tier.monthlyPriceId : tier.annualPriceId;
  const isLoading = loading && loadingId === priceId;
  const monthlyEquivalent = billingInterval === "annual" ? Math.round(tier.annualPrice / 12) : null;

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
        billingInterval === "annual" && tier.savingsPercentage ? "pt-6" : ""
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

      {billingInterval === "annual" && tier.savingsPercentage ? (
        <div className="absolute right-6 top-6">
          <Badge tone="success" variant="solid" size="sm" className="shadow-sm">
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
              /{billingInterval === "monthly" ? "month" : "year"}
            </span>
          </div>
          {monthlyEquivalent ? (
            <p className="text-sm text-muted-foreground">
              That&apos;s only ${monthlyEquivalent}/month
            </p>
          ) : null}
          <div className="flex items-center gap-2 text-sm font-medium text-accent">
            <TrendingUp className="h-4 w-4" aria-hidden="true" />
            {tier.aiCredits} AI credits included monthly
          </div>
        </div>

        {tier.highlighted && tier.highlighted.length > 0 ? (
          <div className="space-y-2 rounded-lg border border-accent/30 bg-accent/5 p-4">
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
        <Button
          fullWidth
          tone={tier.recommended ? "accent" : "neutral"}
          variant="solid"
          size="lg"
          loading={isLoading}
          disabled={!priceId}
          onClick={() => priceId && onCheckout(priceId, tier.name)}
        >
          Get started
        </Button>

        {tier.recommended ? (
          <p className="text-center text-xs text-muted-foreground">
            Chosen by 73% of our users
          </p>
        ) : null}
      </CardFooter>
    </Card>
  );
}
