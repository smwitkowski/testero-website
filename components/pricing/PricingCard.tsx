"use client";

import React from "react";
import { CheckCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PMLE_PASS, PMLE_PASS_FEATURES } from "@/lib/pricing/constants";

interface PricingCardProps {
  onCheckout: () => void;
  loading?: boolean;
}

export function PricingCard({ onCheckout, loading = false }: PricingCardProps) {
  return (
    <Card size="lg" className="w-full border-border/60">
      <CardHeader className="gap-2">
        <CardTitle className="text-3xl font-semibold text-foreground">{PMLE_PASS.name}</CardTitle>
        <CardDescription>Full PMLE access for {PMLE_PASS.durationDays} days</CardDescription>
      </CardHeader>
      <CardContent className="gap-6">
        <div className="space-y-3">
          <p className="flex items-baseline gap-2">
            <span className="text-5xl font-semibold tracking-tight text-foreground">US${PMLE_PASS.price}</span>
            <span className="text-lg text-muted-foreground">one-time</span>
          </p>
          <p className="text-sm text-muted-foreground">No subscription. No automatic renewal.</p>
        </div>
        <ul className="space-y-3">
          {PMLE_PASS_FEATURES.map((feature) => (
            <li key={feature} className="flex items-start gap-3 text-sm text-muted-foreground">
              <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-success" aria-hidden="true" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-3 border-0 pt-0">
        <Button fullWidth tone="accent" size="lg" loading={loading} disabled={loading} onClick={() => onCheckout()}>
          Get {PMLE_PASS.name}
        </Button>
        <p className="text-sm text-muted-foreground">
          {PMLE_PASS.refundDays}-day refund window. A refund ends your pass access.
        </p>
      </CardFooter>
    </Card>
  );
}
