"use client";

import React, { useState } from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { usePostHog } from "posthog-js/react";
import { Form } from "@/components/ui/form";
import { motion, AnimatePresence } from "framer-motion";
import { getAnonymousSessionId } from '@/lib/auth/anonymous-session';
import { AuthLayout } from "@/components/auth/auth-layout";
import { AuthFormField } from "@/components/auth/auth-form-field";
import { AuthErrorAlert } from "@/components/auth/auth-error-alert";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";

const signupFormSchema = z.object({
  email: z
    .string()
    .min(1, { message: "Email is required" })
    .email({ message: "Must be a valid email address" })
    .transform((val) => val.toLowerCase().trim()),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" }),
});

type SignupFormValues = z.infer<typeof signupFormSchema>;

const SignupPage = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const posthog = usePostHog();

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(data: SignupFormValues) {
    setIsSubmitting(true);
    setError(null);

    try {
      if (posthog) {
        posthog.capture('signup_attempt');
      }

      // Get anonymous session ID for guest upgrade functionality
      const anonymousSessionId = getAnonymousSessionId();

      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          ...(anonymousSessionId && { anonymousSessionId }),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Something went wrong. Please try again.');
      }

      // Track successful signup with guest upgrade info
      if (posthog) {
        posthog.capture('signup_success', {
          guestUpgraded: result.guestUpgraded || false,
          sessionsTransferred: result.sessionsTransferred || 0,
        });
      }

      setIsSubmitted(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(errorMessage);
      if (posthog) {
        posthog.capture('signup_error', {
          error_message: errorMessage,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Sign up to start practicing with Testero"
      footerText="Already have an account?"
      footerLink={{ href: "/login", text: "Sign in" }}
    >
            <AnimatePresence mode="wait">
              {!isSubmitted ? (
                <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      <AuthFormField
                        control={form.control}
                        name="email"
                        type="email"
                        placeholder="Email address"
                        autoComplete="email"
                        autoFocus
                        disabled={isSubmitting}
                      />

                      <AuthFormField
                        control={form.control}
                        name="password"
                        type="password"
                        placeholder="Password"
                        autoComplete="new-password"
                        disabled={isSubmitting}
                      />

                      {error && <AuthErrorAlert error={error} />}

                      <AuthSubmitButton
                        isSubmitting={isSubmitting}
                        loadingText="Signing up..."
                        submitText="Sign Up"
                      />
                    </form>
                  </Form>
                </motion.div>
              ) : (
                <motion.div key="success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 text-center">
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                    <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-slate-900">Check your email</h3>
                  <p className="text-slate-600">We&#39;ve sent a confirmation link to {form.getValues().email}. Please follow the instructions to complete your registration.</p>
                </motion.div>
              )}
            </AnimatePresence>
    </AuthLayout>
  );
};

export default SignupPage;
