"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { CheckCircleIcon, XCircleIcon, ClockIcon } from "@heroicons/react/24/outline";
import { usePostHog } from "posthog-js/react";

interface Subscription {
  id: string;
  status: string;
  plan_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
  plan?: {
    name: string;
    price_monthly: number;
    price_yearly: number;
  };
}

interface PaymentHistory {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  stripe_payment_intent_id: string;
}

function BillingDashboardContent() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const posthog = usePostHog();
  const supabase = createClient();

  useEffect(() => {
    const fetchSubscriptionData = async () => {
      try {
        // Fetch subscription with plan details
        const { data: subData, error: subError } = await supabase
          .from("user_subscriptions")
          .select(
            `
            *,
            plan:subscription_plans(*)
          `
          )
          .eq("user_id", user?.id)
          .single();

        if (subError && subError.code !== "PGRST116") {
          console.error("Error fetching subscription:", subError);
        } else if (subData) {
          setSubscription(subData);
        }

        // Fetch payment history
        const { data: paymentData, error: paymentError } = await supabase
          .from("payment_history")
          .select("*")
          .eq("user_id", user?.id)
          .order("created_at", { ascending: false })
          .limit(10);

        if (paymentError) {
          console.error("Error fetching payment history:", paymentError);
        } else if (paymentData) {
          setPaymentHistory(paymentData);
        }
      } catch (error) {
        console.error("Error fetching billing data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchSubscriptionData();

      // Track successful checkout
      if (searchParams.get("success") === "true") {
        posthog?.capture("checkout_completed", {
          user_id: user.id,
        });
      }
    } else if (!user && !loading) {
      router.push("/login?redirect=/dashboard/billing");
    }
  }, [user, loading, router, posthog, searchParams, supabase]);

  const handleManageSubscription = async () => {
    try {
      setPortalLoading(true);

      posthog?.capture("billing_portal_requested", {
        user_id: user?.id,
        subscription_status: subscription?.status,
      });

      const response = await fetch("/api/billing/portal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create portal session");
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Portal session error:", error);
      setError("Failed to open billing portal. Please try again.");
      setTimeout(() => setError(null), 5000);
    } finally {
      setPortalLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: {
        icon: CheckCircleIcon,
        text: "Active",
        className: "bg-green-100 text-green-800",
      },
      trialing: {
        icon: ClockIcon,
        text: "Trial",
        className: "bg-blue-100 text-blue-800",
      },
      past_due: {
        icon: XCircleIcon,
        text: "Past Due",
        className: "bg-red-100 text-red-800",
      },
      canceled: {
        icon: XCircleIcon,
        text: "Canceled",
        className: "bg-gray-100 text-gray-800",
      },
      incomplete: {
        icon: ClockIcon,
        text: "Incomplete",
        className: "bg-yellow-100 text-yellow-800",
      },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.canceled;
    const Icon = config.icon;

    return (
      <span
        className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${config.className}`}
      >
        <Icon className="h-4 w-4 mr-1" />
        {config.text}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount / 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Billing & Subscription</h1>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Success Alert */}
        {searchParams.get("success") === "true" && (
          <div className="mb-6 rounded-md bg-green-50 p-4">
            <div className="flex">
              <CheckCircleIcon className="h-5 w-5 text-green-400" />
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">
                  Payment successful! Your subscription is now active.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Subscription Status */}
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Current Subscription</h2>

          {subscription ? (
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-lg font-medium text-gray-900">
                    {subscription.plan?.name || "Subscription"}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {subscription.plan && (
                      <>
                        {subscription.current_period_end &&
                        new Date(subscription.current_period_end).getTime() -
                          new Date(subscription.current_period_start).getTime() >
                          31 * 24 * 60 * 60 * 1000
                          ? formatAmount(subscription.plan.price_yearly) + "/year"
                          : formatAmount(subscription.plan.price_monthly) + "/month"}
                      </>
                    )}
                  </p>
                </div>
                {getStatusBadge(subscription.status)}
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Current period</span>
                  <span className="text-gray-900">
                    {formatDate(subscription.current_period_start)} -{" "}
                    {formatDate(subscription.current_period_end)}
                  </span>
                </div>

                {subscription.cancel_at_period_end && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Cancels on</span>
                    <span className="text-red-600 font-medium">
                      {formatDate(subscription.current_period_end)}
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-4">
                <button
                  onClick={handleManageSubscription}
                  disabled={portalLoading}
                  className="w-full sm:w-auto px-6 py-3 border border-gray-300 rounded-md shadow-sm text-base font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {portalLoading ? (
                    <span className="flex items-center">
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-700"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Loading...
                    </span>
                  ) : (
                    "Manage Subscription"
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">You don&apos;t have an active subscription.</p>
              <button
                onClick={() => router.push("/pricing")}
                className="px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors"
              >
                View Plans
              </button>
            </div>
          )}
        </div>

        {/* Payment History */}
        {paymentHistory.length > 0 && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Payment History</h2>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paymentHistory.map((payment) => (
                    <tr key={payment.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(payment.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatAmount(payment.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            payment.status === "succeeded"
                              ? "bg-green-100 text-green-800"
                              : payment.status === "failed"
                                ? "bg-red-100 text-red-800"
                                : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {payment.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function BillingDashboard() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      }
    >
      <BillingDashboardContent />
    </Suspense>
  );
}
