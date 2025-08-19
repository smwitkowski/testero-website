"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { usePostHog } from "posthog-js/react";
import { motion } from "framer-motion";
import { HoverButton } from "@/components/marketing/buttons/hover-button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { supabase } from "@/lib/supabase/client";

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
type ResetState = "loading" | "form" | "success" | "error";

const ResetPasswordPage = () => {
  const [resetState, setResetState] = useState<ResetState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
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
        // Track page view
        if (posthog) {
          posthog.capture("password_reset_page_viewed");
        }

        // Get token_hash from URL query parameters
        const urlParams = new URLSearchParams(window.location.search);
        const tokenHash = urlParams.get("token_hash");
        const type = urlParams.get("type");

        if (!tokenHash || type !== "recovery") {
          throw new Error("Invalid or missing reset token in URL");
        }

        // Exchange the token for a session using verifyOtp
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

        // If we successfully verified the token and have a session, show the form
        setResetState("form");
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Invalid or expired reset link";
        setError(errorMessage);
        setResetState("error");

        // Track error
        if (posthog) {
          posthog.capture("password_reset_page_error", {
            error_message: errorMessage,
          });
        }
      }
    };

    checkResetToken();
  }, [posthog]);

  const onSubmit = async (data: ResetPasswordFormValues) => {
    setIsSubmitting(true);
    setError(null);

    try {
      // Track password reset attempt
      if (posthog) {
        posthog.capture("password_reset_attempt");
      }

      // Update the user's password
      const { error } = await supabase.auth.updateUser({
        password: data.password,
      });

      if (error) {
        throw error;
      }

      // Track success
      if (posthog) {
        posthog.capture("password_reset_success");
      }

      setResetState("success");

      // Auto-redirect to login after 3 seconds
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to reset password";
      setError(errorMessage);

      // Track error
      if (posthog) {
        posthog.capture("password_reset_submit_error", {
          error_message: errorMessage,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackToLogin = () => {
    router.push("/login");
  };

  return (
    <div className="min-h-screen pt-24 pb-12 md:pt-32 flex flex-col items-center justify-start bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="w-full max-w-md px-6">
        {/* Card Container */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white shadow-lg rounded-xl border border-slate-200 overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 py-8 text-center border-b border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-2">
              {resetState === "loading" && "Reset Your Password"}
              {resetState === "form" && "Set New Password"}
              {resetState === "success" && "Password Updated!"}
              {resetState === "error" && "Reset Failed"}
            </h1>
            <p className="text-slate-600">
              {resetState === "loading" && "Verifying your reset link..."}
              {resetState === "form" && "Choose a strong password for your account"}
              {resetState === "success" && "Your password has been successfully updated"}
              {resetState === "error" && "There was a problem with your reset link"}
            </p>
          </div>

          {/* Content */}
          <div className="px-6 py-8">
            {resetState === "loading" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center space-y-6"
              >
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100">
                  <svg
                    className="animate-spin h-6 w-6 text-blue-600"
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
                </div>
                <p className="text-slate-600">Verifying your reset link...</p>
              </motion.div>
            )}

            {resetState === "form" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    {/* Password Field */}
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field, fieldState }) => (
                        <FormItem>
                          <div className="relative">
                            <FormControl>
                              <Input
                                type="password"
                                placeholder="New password"
                                className={`px-4 py-3 text-base rounded-md transition-all duration-300 border-2 ${
                                  fieldState.error
                                    ? "border-red-400 bg-red-50"
                                    : fieldState.isDirty && !fieldState.error
                                      ? "border-green-400 bg-green-50"
                                      : "border-slate-300 focus:border-orange-400 focus:ring focus:ring-orange-200 focus:ring-opacity-50"
                                }`}
                                disabled={isSubmitting}
                                autoComplete="new-password"
                                autoFocus
                                aria-required="true"
                                aria-invalid={fieldState.error ? "true" : "false"}
                                {...field}
                              />
                            </FormControl>

                            {/* Validation icon */}
                            {fieldState.isDirty && (
                              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                {fieldState.error ? (
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-5 w-5 text-red-500"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                ) : (
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-5 w-5 text-green-500"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                )}
                              </div>
                            )}
                          </div>
                          <FormMessage className="text-left mt-1 font-medium" />
                        </FormItem>
                      )}
                    />

                    {/* Confirm Password Field */}
                    <FormField
                      control={form.control}
                      name="confirmPassword"
                      render={({ field, fieldState }) => (
                        <FormItem>
                          <div className="relative">
                            <FormControl>
                              <Input
                                type="password"
                                placeholder="Confirm new password"
                                className={`px-4 py-3 text-base rounded-md transition-all duration-300 border-2 ${
                                  fieldState.error
                                    ? "border-red-400 bg-red-50"
                                    : fieldState.isDirty && !fieldState.error
                                      ? "border-green-400 bg-green-50"
                                      : "border-slate-300 focus:border-orange-400 focus:ring focus:ring-orange-200 focus:ring-opacity-50"
                                }`}
                                disabled={isSubmitting}
                                autoComplete="new-password"
                                aria-required="true"
                                aria-invalid={fieldState.error ? "true" : "false"}
                                {...field}
                              />
                            </FormControl>

                            {/* Validation icon */}
                            {fieldState.isDirty && (
                              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                {fieldState.error ? (
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-5 w-5 text-red-500"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                ) : (
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-5 w-5 text-green-500"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                )}
                              </div>
                            )}
                          </div>
                          <FormMessage className="text-left mt-1 font-medium" />
                        </FormItem>
                      )}
                    />

                    {/* Error Alert */}
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-red-50 border border-red-200 rounded-md px-4 py-3 text-center"
                        role="alert"
                        aria-live="assertive"
                      >
                        <p className="text-red-600 font-medium flex items-center justify-center text-sm">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            className="w-5 h-5 mr-2"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                            />
                          </svg>
                          {error}
                        </p>
                      </motion.div>
                    )}

                    {/* Submit Button */}
                    <HoverButton
                      className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-6 py-3 rounded-md text-base font-semibold shadow-md w-full transition-all"
                      type="submit"
                      disabled={isSubmitting}
                      aria-busy={isSubmitting ? "true" : "false"}
                    >
                      {isSubmitting ? (
                        <div className="flex items-center justify-center">
                          <svg
                            className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
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
                          Updating Password...
                        </div>
                      ) : (
                        <div className="flex items-center justify-center">
                          <span>Update Password</span>
                        </div>
                      )}
                    </HoverButton>
                  </form>
                </Form>
              </motion.div>
            )}

            {resetState === "success" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center space-y-6"
              >
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
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

                <div className="space-y-3">
                  <h3 className="text-lg font-medium text-slate-900">
                    Password Updated Successfully!
                  </h3>
                  <p className="text-slate-600">
                    Your password has been changed. You can now sign in with your new password.
                  </p>

                  <div className="space-y-3">
                    <p className="text-slate-500 text-sm">
                      You&apos;ll be automatically redirected to the login page in a few seconds.
                    </p>

                    <button
                      onClick={handleBackToLogin}
                      className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-6 py-3 rounded-md text-base font-semibold shadow-md transition-all"
                    >
                      Continue to Login
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {resetState === "error" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center space-y-6"
              >
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                  <svg
                    className="h-6 w-6 text-red-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </div>

                <div className="space-y-3">
                  <h3 className="text-lg font-medium text-slate-900">Unable to Reset Password</h3>

                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3">
                      <p className="text-red-600 text-sm font-medium">{error}</p>
                    </div>
                  )}

                  <div className="space-y-3">
                    <p className="text-slate-600 text-sm">
                      The reset link may have expired or been used already. Please request a new
                      password reset.
                    </p>

                    <button
                      onClick={handleBackToLogin}
                      className="w-full bg-gradient-to-r from-slate-500 to-slate-600 hover:from-slate-600 hover:to-slate-700 text-white px-6 py-3 rounded-md text-base font-semibold shadow-md transition-all"
                    >
                      Back to Login
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Visual Decoration */}
        <div className="absolute inset-0 opacity-10 pointer-events-none" aria-hidden="true">
          <div className="absolute top-0 left-1/4 w-64 h-64 rounded-full bg-blue-500 mix-blend-multiply blur-3xl"></div>
          <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full bg-orange-500 mix-blend-multiply blur-3xl"></div>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
