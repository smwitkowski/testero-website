"use client";

import React, { useState, useEffect } from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePostHog } from "posthog-js/react";
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/AuthProvider';
import { HoverButton } from "@/components/ui/hover-button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { motion, AnimatePresence } from "framer-motion";

// Define the form schema with zod validation
const resetPasswordFormSchema = z.object({
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" }),
  confirmPassword: z
    .string()
    .min(1, { message: "Please confirm your password" }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"], // path of error
});

type ResetPasswordFormValues = z.infer<typeof resetPasswordFormSchema>;

const ResetPasswordPage = () => {
  // Form states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccessful, setIsSuccessful] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isValidLink, setIsValidLink] = useState<boolean>(false);
  const [isCheckingLink, setIsCheckingLink] = useState<boolean>(true);
  const posthog = usePostHog(); // Get PostHog instance
  const router = useRouter();
  const { user } = useAuth();
  
  // If user is already authenticated and not in reset flow, redirect to dashboard
  useEffect(() => {
    if (user && !isCheckingLink) {
      router.push('/practice/question');
    }
  }, [user, router, isCheckingLink]);

  // Initialize the form
  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  // Check for valid recovery token on page load
  useEffect(() => {
    const checkRecoveryToken = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          throw new Error(error.message);
        }

        // If we have a valid session with recovery flow
        if (data?.session?.user) {
          setIsValidLink(true);
          
          // Track valid recovery link in PostHog
          if (posthog) {
            posthog.capture('password_reset_link_valid');
          }
        } else {
          setError("Invalid or expired password reset link. Please request a new one.");
          
          // Track invalid recovery link in PostHog
          if (posthog) {
            posthog.capture('password_reset_link_invalid');
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Invalid or expired link. Please try again.";
        setError(errorMessage);
        
        // Track error in PostHog
        if (posthog) {
          posthog.capture('password_reset_link_error', {
            error_message: errorMessage,
          });
        }
      } finally {
        setIsCheckingLink(false);
      }
    };

    checkRecoveryToken();
  }, [posthog]);

  // Track page view in PostHog
  useEffect(() => {
    if (posthog) {
      posthog.capture('reset_password_page_viewed');
    }
  }, [posthog]);

  // Handle form submission
  async function onSubmit(data: ResetPasswordFormValues) {
    setIsSubmitting(true);
    setError(null);
    
    try {
      // Track password reset attempt in PostHog
      if (posthog) {
        posthog.capture('password_reset_attempt');
      }

      // Call Supabase auth API to update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: data.password,
      });

      if (updateError) {
        throw new Error(updateError.message);
      }
      
      // Show success state
      setIsSuccessful(true);
      
      // Track success in PostHog
      if (posthog) {
        posthog.capture('password_reset_success');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to reset password. Please try again.";
      setError(errorMessage);
      
      // Track error in PostHog
      if (posthog) {
        posthog.capture('password_reset_error', {
          error_message: errorMessage,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

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
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-2">Set New Password</h1>
            <p className="text-slate-600">Create a new password for your account</p>
          </div>

          {/* Form Container */}
          <div className="px-6 py-8">
            <AnimatePresence mode="wait">
              {isCheckingLink ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="py-8 text-center"
                >
                  <div className="flex justify-center mb-4">
                    <svg 
                      className="animate-spin h-10 w-10 text-orange-500" 
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
                  </div>
                  <p className="text-slate-600">Verifying your reset link...</p>
                </motion.div>
              ) : isSuccessful ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-6"
                >
                  {/* Success Message */}
                  <div className="text-center">
                    <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                      <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-slate-900 mb-2">Password Reset Successful</h3>
                    <p className="text-slate-600 mb-4">
                      Your password has been updated successfully. You can now log in with your new password.
                    </p>
                  </div>

                  {/* Login Button */}
                  <Link 
                    href="/login" 
                    className="block w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-6 py-3 rounded-md text-base font-semibold shadow-md text-center"
                  >
                    Go to Login
                  </Link>
                </motion.div>
              ) : isValidLink ? (
                <motion.div
                  key="form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
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
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                  ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
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
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                  ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
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
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                            </svg>
                            {error}
                          </p>
                        </motion.div>
                      )}

                      {/* Password Requirements */}
                      <div className="bg-blue-50 border border-blue-100 rounded-md px-4 py-3">
                        <p className="text-blue-700 text-sm mb-1">
                          Your password must be:
                        </p>
                        <ul className="text-blue-700 text-sm list-disc list-inside">
                          <li>At least 8 characters long</li>
                          <li>Both passwords must match</li>
                        </ul>
                      </div>

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
                            <span>Reset Password</span>
                          </div>
                        )}
                      </HoverButton>
                    </form>
                  </Form>
                </motion.div>
              ) : (
                <motion.div
                  key="invalid"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="py-4 space-y-6"
                >
                  {/* Invalid Link Message */}
                  <div className="text-center">
                    <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-slate-900 mb-2">Invalid Reset Link</h3>
                    <p className="text-slate-600 mb-4">
                      {error || "Your password reset link is invalid or has expired. Please request a new link."}
                    </p>
                  </div>

                  {/* Request New Link Button */}
                  <Link 
                    href="/forgot-password" 
                    className="block w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-6 py-3 rounded-md text-base font-semibold shadow-md text-center"
                  >
                    Request New Link
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Back to Login Link */}
        <div className="mt-8 text-center">
          <p className="text-slate-600">
            Remember your password?{' '}
            <Link 
              href="/login" 
              className="text-orange-500 hover:text-orange-600 transition-colors font-medium"
            >
              Back to login
            </Link>
          </p>
        </div>

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
