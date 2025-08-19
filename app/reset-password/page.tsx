"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { usePostHog } from "posthog-js/react";
import { HoverButton } from "@/components/marketing/buttons/hover-button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { supabase } from "@/lib/supabase/client";

// Import universal auth components
import {
  AuthFlowTemplate,
  AuthLoadingState,
  AuthSuccessState,
  AuthErrorState,
  useAuthState,
} from "@/components/auth";

const resetPasswordSchema = z
  .object({
    password: z.string().min(8, { message: "Password must be at least 8 characters" }),
    confirmPassword: z.string().min(8, { message: "Please confirm your password" }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

const ResetPasswordPage = () => {
  const { state, setState, error, setError } = useAuthState({
    initialState: "loading",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const posthog = usePostHog();

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    const checkResetToken = async () => {
      try {
        if (posthog) {
          posthog.capture("password_reset_page_viewed");
        }

        const urlParams = new URLSearchParams(window.location.search);
        const tokenHash = urlParams.get("token_hash");
        const type = urlParams.get("type");

        if (!tokenHash || type !== "recovery") {
          throw new Error("Invalid or missing reset token in URL");
        }

        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "recovery",
        });

        if (error) {
          throw error;
        }

        if (!data.session) {
          throw new Error("Failed to establish session from reset token");
        }

        setState("form");
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Invalid or expired reset link";
        setError(errorMessage);
        setState("error");

        if (posthog) {
          posthog.capture("password_reset_page_error", {
            error_message: errorMessage,
          });
        }
      }
    };

    checkResetToken();
  }, [posthog, setState, setError]);

  const onSubmit = async (data: ResetPasswordFormValues) => {
    setIsSubmitting(true);
    setError(null);

    try {
      if (posthog) {
        posthog.capture("password_reset_attempt");
      }

      const { error } = await supabase.auth.updateUser({
        password: data.password,
      });

      if (error) {
        throw error;
      }

      if (posthog) {
        posthog.capture("password_reset_success");
      }

      setState("success");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to reset password";
      setError(errorMessage);
      setState("error");

      if (posthog) {
        posthog.capture("password_reset_submit_error", {
          error_message: errorMessage,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetry = () => {
    setState("form");
    setError(null);
    form.reset();
  };

  return (
    <AuthFlowTemplate
      title={state === "loading" ? "Verifying Reset Token" : "Reset Your Password"}
      description={
        state === "form"
          ? "Enter your new password below"
          : state === "loading"
            ? "Please wait while we verify your reset token..."
            : undefined
      }
      currentState={state}
      footerLinks={
        state !== "loading"
          ? [
              {
                text: "Remember your password?",
                href: "/login",
                label: "Back to Login",
              },
            ]
          : []
      }
      onMount={() => {
        if (posthog) {
          posthog.capture("reset_password_page_mounted");
        }
      }}
    >
      {state === "loading" && (
        <AuthLoadingState
          title="Verifying Your Token"
          message="Please wait while we verify your reset token..."
        />
      )}

      {state === "form" && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="New Password"
                      className="h-12 px-4 py-3 rounded-md bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={isSubmitting}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-red-600 text-sm mt-1" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Confirm New Password"
                      className="h-12 px-4 py-3 rounded-md bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={isSubmitting}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-red-600 text-sm mt-1" />
                </FormItem>
              )}
            />

            <HoverButton type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Resetting..." : "Reset Password"}
            </HoverButton>
          </form>
        </Form>
      )}

      {state === "success" && (
        <AuthSuccessState
          title="Password Reset Successfully!"
          message="Your password has been updated. Redirecting to login..."
          redirectPath="/login"
          autoRedirect={true}
          redirectDelay={3000}
          actionButton={{
            text: "Go to Login Now",
            action: "redirect",
          }}
        />
      )}

      {state === "error" && (
        <AuthErrorState
          title="Password Reset Failed"
          message={error || "Something went wrong. Please try again."}
          errorDetails={
            error?.includes("expired")
              ? "Your reset link may have expired. Please request a new one."
              : undefined
          }
          onRetry={error?.includes("expired") ? undefined : handleRetry}
          retryButtonText="Try Again"
          redirectPath="/forgot-password"
          redirectButtonText="Request New Link"
        />
      )}
    </AuthFlowTemplate>
  );
};

export default ResetPasswordPage;
