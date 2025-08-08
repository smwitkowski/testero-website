"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { usePostHog } from "posthog-js/react";
import { Form } from "@/components/ui/form";
import { motion, AnimatePresence } from "framer-motion";
import { AuthLayout } from "@/components/auth/auth-layout";
import { AuthFormField } from "@/components/auth/auth-form-field";
import { AuthErrorAlert } from "@/components/auth/auth-error-alert";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";

// Define the form schema with zod validation
const forgotPasswordFormSchema = z.object({
  email: z
    .string()
    .min(1, { message: "Email is required" })
    .email({ message: "Must be a valid email address" })
    .transform((val) => val.toLowerCase().trim()),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordFormSchema>;

const ForgotPasswordPage = () => {
  // Form states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState<string>("");
  const [resendEnabled, setResendEnabled] = useState<boolean>(false);
  const posthog = usePostHog(); // Get PostHog instance

  // Initialize the form
  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordFormSchema),
    defaultValues: {
      email: "",
    },
  });

  // Track page view in PostHog
  React.useEffect(() => {
    if (posthog) {
      posthog.capture("forgot_password_page_viewed");
    }

    // Enable resend button after 60 seconds
    if (isSubmitted) {
      const timer = setTimeout(() => {
        setResendEnabled(true);
      }, 60000);

      return () => clearTimeout(timer);
    }
  }, [posthog, isSubmitted]);

  // Handle form submission
  async function onSubmit(data: ForgotPasswordFormValues) {
    setIsSubmitting(true);
    setError(null);

    try {
      // Track reset password attempt in PostHog
      if (posthog) {
        posthog.capture("password_reset_requested", {
          email: data.email,
        });
      }

      // Call the password reset API
      const response = await fetch("/api/auth/password-reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: data.email }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { error?: string };
        throw new Error(errorData.error || "Password reset failed");
      }

      // Store email for confirmation screen
      setSubmittedEmail(data.email);

      // Show success state
      setIsSubmitted(true);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(errorMessage);

      // Track error in PostHog
      if (posthog) {
        posthog.capture("password_reset_error", {
          error_message: errorMessage,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  // Handle resend request
  async function handleResend() {
    if (!resendEnabled) return;

    // Track resend request in PostHog
    if (posthog) {
      posthog.capture("password_reset_resend_requested", {
        email: submittedEmail,
      });
    }

    setResendEnabled(false);

    try {
      // Call the password reset API again
      const response = await fetch("/api/auth/password-reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: submittedEmail }),
      });

      if (!response.ok) {
        await response.json();
        // Don't show error to user, just log it
      }
    } catch {
      // Don't show error to user, just log it
    }

    // Enable resend button again after 60 seconds
    setTimeout(() => {
      setResendEnabled(true);
    }, 60000);
  }

  return (
    <AuthLayout
      title="Reset Your Password"
      subtitle="Enter your email to receive a password reset link"
      footerText="Remember your password?"
      footerLink={{ href: "/login", text: "Back to login" }}
    >
      <AnimatePresence mode="wait">
        {!isSubmitted ? (
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
                      posthog.capture("forgot_password_form_interaction_start");
                    }
                  }}
                />

                {/* Error Alert */}
                {error && <AuthErrorAlert error={error} />}

                {/* Instructions */}
                <div className="bg-blue-50 border border-blue-100 rounded-md px-4 py-3">
                  <p className="text-blue-700 text-sm">
                    We&apos;ll send you an email with a link to reset your password. The link will
                    expire after 24 hours.
                  </p>
                </div>

                {/* Submit Button */}
                <AuthSubmitButton
                  isSubmitting={isSubmitting}
                  loadingText="Sending..."
                  submitText="Send Reset Link"
                />
              </form>
            </Form>
          </motion.div>
        ) : (
          <motion.div
            key="success"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Success Message */}
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <svg
                  className="h-6 w-6 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">Check your email</h3>
              <p className="text-slate-600 mb-1">We&apos;ve sent a password reset link to:</p>
              <p className="text-slate-900 font-medium mb-4">{submittedEmail}</p>
              <p className="text-slate-600 text-sm">
                If you don&apos;t see it in your inbox, please check your spam folder.
              </p>
            </div>

            {/* Resend Email Option */}
            <div className="border-t border-slate-200 pt-4 text-center">
              <p className="text-slate-600 text-sm mb-3">Didn&apos;t receive the email?</p>
              <button
                type="button"
                onClick={handleResend}
                disabled={!resendEnabled}
                className={`text-sm font-medium ${
                  resendEnabled
                    ? "text-orange-500 hover:text-orange-600 cursor-pointer"
                    : "text-slate-400 cursor-not-allowed"
                }`}
              >
                {resendEnabled ? "Resend Email" : "Resend available in 60s"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthLayout>
  );
};

export default ForgotPasswordPage;
