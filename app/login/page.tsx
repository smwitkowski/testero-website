"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { usePostHog } from "posthog-js/react";
import { Form } from "@/components/ui/form";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase/client";
import { AuthLayout } from "@/components/auth/auth-layout";
import { AuthFormField } from "@/components/auth/auth-form-field";
import { AuthErrorAlert } from "@/components/auth/auth-error-alert";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";

// Define the form schema with zod validation
const loginFormSchema = z.object({
  email: z
    .string()
    .min(1, { message: "Email is required" })
    .email({ message: "Must be a valid email address" })
    .transform((val) => val.toLowerCase().trim()),
  password: z.string().min(8, { message: "Password must be at least 8 characters" }),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

const LoginPage = () => {
  // Form submission states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmationWarning, setShowConfirmationWarning] = useState(false);
  const [resendState, setResendState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [userEmail, setUserEmail] = useState<string>("");
  const posthog = usePostHog(); // Get PostHog instance

  // Initialize the form
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Handle resend confirmation email
  async function handleResendConfirmation() {
    if (!userEmail || resendCooldown > 0) return;

    setResendState("loading");

    try {
      // Track resend attempt in PostHog
      if (posthog) {
        posthog.capture("login_resend_confirmation_attempt", {
          email: userEmail,
        });
      }

      const response = await fetch("/api/auth/resend-confirmation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: userEmail }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { error?: string };
        throw new Error(errorData.error || "Failed to resend confirmation email");
      }

      setResendState("success");

      // Start 60-second cooldown
      setResendCooldown(60);
      const countdown = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(countdown);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Track success in PostHog
      if (posthog) {
        posthog.capture("login_resend_confirmation_success", {
          email: userEmail,
        });
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to resend confirmation email";
      setResendState("error");

      // Track error in PostHog
      if (posthog) {
        posthog.capture("login_resend_confirmation_error", {
          email: userEmail,
          error_message: errorMessage,
        });
      }
    }
  }

  // Handle form submission
  async function onSubmit(data: LoginFormValues) {
    setIsSubmitting(true);
    setError(null);
    setShowConfirmationWarning(false);

    try {
      // Track login attempt in PostHog
      if (posthog) {
        posthog.capture("login_attempt", {
          email: data.email,
        });
      }

      // Replace with actual login logic
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        // Check if the error is related to email confirmation
        if (
          error.message.toLowerCase().includes("email not confirmed") ||
          error.message.toLowerCase().includes("confirm your email") ||
          error.message.toLowerCase().includes("email confirmation")
        ) {
          setUserEmail(data.email);
          setShowConfirmationWarning(true);
          setResendState("idle");

          // Track unconfirmed login attempt in PostHog
          if (posthog) {
            posthog.capture("login_unconfirmed_user", {
              email: data.email,
            });
          }

          return; // Don't throw the error, show confirmation warning instead
        }

        throw error;
      }

      // If successful, Supabase's onAuthStateChange listener in AuthProvider
      // will handle the session update and redirection.

      // Add a manual redirect as a backup
      // Sometimes the auth state change might not trigger immediately
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 1500);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(errorMessage);

      // Track error in PostHog
      if (posthog) {
        posthog.capture("login_error", {
          error_message: errorMessage,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome Back"
      subtitle="Sign in to your Testero account"
      footerText="Don't have an account?"
      footerLink={{ href: "/signup", text: "Create an account" }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key="form"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Email Field */}
              <AuthFormField
                control={form.control}
                name="email"
                type="email"
                placeholder="Email address"
                autoComplete="email"
                autoFocus
                disabled={isSubmitting}
                onFocus={() => {
                  if (posthog) {
                    posthog.capture("login_form_interaction_start");
                  }
                }}
              />

              {/* Password Field */}
              <AuthFormField
                control={form.control}
                name="password"
                type="password"
                placeholder="Password"
                autoComplete="current-password"
                disabled={isSubmitting}
              />

              {/* Forgot Password Link */}
              <div className="flex justify-end">
                <Link
                  href="/forgot-password"
                  className="text-sm text-orange-500 hover:text-orange-600 transition-colors font-medium"
                >
                  Forgot password?
                </Link>
              </div>

              {/* Error Alert */}
              {error && <AuthErrorAlert error={error} />}

              {/* Email Confirmation Warning */}
              {showConfirmationWarning && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-amber-50 border border-amber-200 rounded-md px-4 py-4"
                  role="alert"
                  aria-live="assertive"
                >
                  <div className="flex items-start">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-5 h-5 text-amber-600 mr-3 mt-0.5 flex-shrink-0"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                      />
                    </svg>
                    <div className="flex-1">
                      <h4 className="text-amber-800 font-medium text-sm mb-2">
                        Email confirmation required
                      </h4>
                      <p className="text-amber-700 text-sm mb-3">
                        Please check your email and click the confirmation link to activate your
                        account.
                      </p>

                      {/* Resend Button */}
                      <button
                        type="button"
                        onClick={handleResendConfirmation}
                        disabled={resendState === "loading" || resendCooldown > 0}
                        className="inline-flex items-center px-3 py-2 border border-amber-300 bg-amber-100 text-amber-800 text-sm font-medium rounded-md hover:bg-amber-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {resendState === "loading" ? (
                          <>
                            <svg
                              className="animate-spin -ml-1 mr-2 h-4 w-4 text-amber-600"
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
                              ></circle>
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              ></path>
                            </svg>
                            Sending...
                          </>
                        ) : resendCooldown > 0 ? (
                          `Resend in ${resendCooldown}s`
                        ) : (
                          "Resend confirmation email"
                        )}
                      </button>

                      {/* Success/Error Messages */}
                      {resendState === "success" && (
                        <p className="text-green-700 text-sm mt-2 flex items-center">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4 mr-1"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          Confirmation email sent successfully!
                        </p>
                      )}

                      {resendState === "error" && (
                        <p className="text-red-700 text-sm mt-2 flex items-center">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4 mr-1"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                          Failed to send confirmation email. Please try again.
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Login Button */}
              <AuthSubmitButton
                isSubmitting={isSubmitting}
                loadingText="Signing in..."
                submitText="Sign In"
              />
            </form>
          </Form>
        </motion.div>
      </AnimatePresence>
    </AuthLayout>
  );
};

export default LoginPage;
