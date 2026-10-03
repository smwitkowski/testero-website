"use client";

import React, { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { usePostHog } from "posthog-js/react";
import type { BillingStatusResponse } from "@/app/api/billing/status/route";
import { PMLE_PASS } from "@/lib/pricing/constants";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface PaymentHistory {
  id: string;
  amount: number;
  status: string;
  created_at: string;
}

const NO_ACCESS: BillingStatusResponse = {
  isSubscriber: false, status: "none", accessType: null, accessUntil: null, canManageSubscription: false,
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function BillingDashboardContent() {
  const [billing, setBilling] = useState(NO_ACCESS);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const portalInFlight = useRef(false);
  const trackedSuccess = useRef(false);
  const { user, isLoading: authLoading } = useAuth();
  const userId = user?.id;
  const router = useRouter();
  const searchParams = useSearchParams();
  const posthog = usePostHog();
  const supabase = useMemo(() => createClient(), []);
  const successParam = searchParams.get("success");
  const showSuccessBanner = successParam === "1" || successParam === "true";

  useEffect(() => {
    if (authLoading) return;
    if (!userId) {
      router.push("/login?redirect=/dashboard/billing");
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setBilling(NO_ACCESS);
    setPaymentHistory([]);
    const loadBilling = async () => {
      try {
        const response = await fetch("/api/billing/status");
        if (!response.ok) throw new Error("Failed to load billing status");
        const data: BillingStatusResponse = await response.json();
        if (active) setBilling(data);
      } catch {
        if (active) setError("Unable to load your access details. Please refresh and try again.");
      } finally {
        if (active) setLoading(false);
      }
    };
    const loadPayments = async () => {
      try {
        const { data, error } = await supabase.from("payment_history").select("id, amount, status, created_at")
          .eq("user_id", userId).order("created_at", { ascending: false }).limit(10);
        if (active && !error && data) setPaymentHistory(data);
      } catch {
        // Receipt history must not hide verified access details.
      }
    };
    void loadBilling();
    void loadPayments();
    return () => { active = false; };
  }, [userId, authLoading, router, supabase]);

  useEffect(() => {
    if (user && showSuccessBanner && !trackedSuccess.current) {
      trackedSuccess.current = true;
      posthog?.capture("checkout_completed", { user_id: user.id, plan_name: PMLE_PASS.name, payment_mode: "payment" });
    }
  }, [user, showSuccessBanner, posthog]);

  const handleManageSubscription = async () => {
    // Only accounts with real legacy billing metadata can use the subscription portal.
    if (!billing.canManageSubscription || portalInFlight.current) return;
    portalInFlight.current = true;
    setPortalLoading(true);
    setError(null);
    try {
      posthog?.capture("billing_portal_requested", { user_id: user?.id, subscription_status: billing.status, access_type: "legacy_subscription" });
      const response = await fetch("/api/billing/portal", { method: "POST", headers: { "Content-Type": "application/json" } });
      const data = (await response.json()) as { error?: string; url?: string };
      if (!response.ok || !data.url) throw new Error(data.error || "Failed to create portal session");
      window.location.href = data.url;
    } catch {
      setError("Failed to open billing portal. Please try again.");
    } finally {
      portalInFlight.current = false;
      setPortalLoading(false);
    }
  };

  if (loading || authLoading) return <div role="status" className="p-12 text-center">Loading billing details…</div>;
  if (!user) return null;

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Billing & Access</h1>
        {error && <div role="alert" className="mb-6 rounded-md bg-red-50 p-4 text-red-800">{error}</div>}
        {showSuccessBanner && (
          <div role="status" className="mb-6 rounded-md bg-green-50 p-4 text-green-800">
            <p>Payment received. Access appears here after payment confirmation.</p>
            <Button asChild variant="outline" className="mt-3"><Link href="/dashboard">Back to your PMLE study plan</Link></Button>
          </div>
        )}
        <section className="bg-white shadow-sm border border-gray-200 rounded-lg p-6 mb-8" aria-labelledby="access-heading">
          <h2 id="access-heading" className="text-xl font-semibold mb-4">Current Access</h2>
          {billing.isSubscriber && billing.accessType ? (
            <div className="space-y-3">
              <p className="text-lg font-medium">{billing.accessType === "pass" ? PMLE_PASS.name : "Legacy subscription"}</p>
              {billing.accessUntil && <p>Access until {formatDate(billing.accessUntil)}</p>}
              {billing.accessType === "pass" ? (
                <>
                  <p>US${PMLE_PASS.price} one-time · {PMLE_PASS.durationDays} days of full access</p>
                  <p>No subscription. No automatic renewal.</p>
                  <p className="text-sm text-gray-600">{PMLE_PASS.refundDays}-day refund window. A refund ends your pass access. Contact <a className="underline" href="mailto:support@testero.ai">support@testero.ai</a> to request a refund.</p>
                </>
              ) : <p>Your existing subscription remains active.</p>}
            </div>
          ) : (
            <div className="space-y-3">
              <p>You don&apos;t have active paid access.</p>
              <Button asChild tone="accent"><Link href="/pricing">Get PMLE Pass</Link></Button>
            </div>
          )}
          {billing.canManageSubscription && (
            <div className="mt-6 border-t pt-4">
              <p className="mb-3 text-sm text-gray-600">Legacy subscription status: {billing.status.replaceAll("_", " ")}</p>
              <Button variant="outline" onClick={handleManageSubscription} disabled={portalLoading} loading={portalLoading}>Manage Subscription</Button>
            </div>
          )}
        </section>
        {paymentHistory.length > 0 && (
          <section className="bg-white shadow-sm border border-gray-200 rounded-lg p-6" aria-labelledby="history-heading">
            <h2 id="history-heading" className="text-xl font-semibold mb-4">Payment History</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead><tr><th scope="col" className="p-3">Date</th><th scope="col" className="p-3">Amount</th><th scope="col" className="p-3">Status</th></tr></thead>
                <tbody>{paymentHistory.map((payment) => (
                  <tr key={payment.id} className="border-t border-gray-200">
                    <td className="p-3">{formatDate(payment.created_at)}</td>
                    <td className="p-3">{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(payment.amount / 100)}</td>
                    <td className="p-3">{payment.status}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default function BillingDashboard() {
  return <Suspense fallback={<div role="status" className="p-12 text-center">Loading billing details…</div>}><BillingDashboardContent /></Suspense>;
}
