"use client";

import React, { useState } from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from 'next/link';
import { usePostHog } from "posthog-js/react";
import { useSearchParams } from 'next/navigation';
import { HoverButton } from "@/components/ui/hover-button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from '@/lib/supabase/client'; // Import supabase client

// Define the form schema with zod validation
const loginFormSchema = z.object({
  email: z
    .string()
    .min(1, { message: "Email is required" })
    .email({ message: "Must be a valid email address" })
    .transform((val) => val.toLowerCase().trim()),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" }),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

const LoginPage = () => {
  // Form submission states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmationWarning, setShowConfirmationWarning] = useState(false);
  const [resendState, setResendState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [userEmail, setUserEmail] = useState<string>('');
  const posthog = usePostHog(); // Get PostHog instance
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get('next') || '/dashboard';

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

    setResendState('loading');
    
    try {
      // Track resend attempt in PostHog
      if (posthog) {
        posthog.capture('login_resend_confirmation_attempt', {
          email: userEmail,
        });
      }

      const response = await fetch('/api/auth/resend-confirmation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: userEmail }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to resend confirmation email');
      }

      setResendState('success');
      
      // Start 60-second cooldown
      setResendCooldown(60);
      const countdown = setInterval(() => {
        setResendCooldown(prev => {
          if (prev <= 1) {
            clearInterval(countdown);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Track success in PostHog
      if (posthog) {
        posthog.capture('login_resend_confirmation_success', {
          email: userEmail,
        });
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to resend confirmation email';
      setResendState('error');
      
      // Track error in PostHog
      if (posthog) {
        posthog.capture('login_resend_confirmation_error', {
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
        posthog.capture('login_attempt', {
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
        if (error.message.toLowerCase().includes('email not confirmed') || 
            error.message.toLowerCase().includes('confirm your email') ||
            error.message.toLowerCase().includes('email confirmation')) {
          
          setUserEmail(data.email);
          setShowConfirmationWarning(true);
          setResendState('idle');
          
          // Track unconfirmed login attempt in PostHog
          if (posthog) {
            posthog.capture('login_unconfirmed_user', {
              email: data.email,
            });
          }
          
          return; // Don't throw the error, show confirmation warning instead
        }
        
        throw error;
      }

      // If successful, Supabase's onAuthStateChange listener in AuthProvider
      // will handle the session update and redirection.
      console.log('Login successful - waiting for redirection');
      
      // Add a manual redirect as a backup
      // Sometimes the auth state change might not trigger immediately
      setTimeout(() => {
        window.location.href = nextUrl;
      }, 1500);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(errorMessage);

      // Track error in PostHog
      if (posthog) {
        posthog.capture('login_error', {
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
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-2">Welcome Back</h1>
            <p className="text-slate-600">Sign in to your Testero account</p>
          </div>

          {/* Form Container */}
          <div className="px-6 py-8">
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
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field, fieldState }) => (
                        <FormItem>
                          <div className="relative">
                            <FormControl>
                              <Input
                                type="email"
                                placeholder="Email address"
                                className={`px-4 py-3 text-base rounded-md transition-all duration-300 border-2 ${
                                  fieldState.error 
                                    ? "border-red-400 bg-red-50" 
                                    : fieldState.isDirty && !fieldState.error
                                      ? "border-green-400 bg-green-50" 
                                      : "border-slate-300 focus:border-orange-400 focus:ring focus:ring-orange-200 focus:ring-opacity-50"
                                }`}
                                disabled={isSubmitting}
                                autoComplete="email"
                                autoFocus
                                aria-required="true"
                                aria-invalid={fieldState.error ? "true" : "false"}
                                {...field}
                                onFocus={() => {
                                  if (posthog) {
                                    posthog.capture('login_form_interaction_start');
                                  }
                                }}
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
                                placeholder="Password"
                                className={`px-4 py-3 text-base rounded-md transition-all duration-300 border-2 ${
                                  fieldState.error 
                                    ? "border-red-400 bg-red-50" 
                                    : fieldState.isDirty && !fieldState.error
                                      ? "border-green-400 bg-green-50" 
                                      : "border-slate-300 focus:border-orange-400 focus:ring focus:ring-orange-200 focus:ring-opacity-50"
                                }`}
                                disabled={isSubmitting}
                                autoComplete="current-password"
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
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-amber-600 mr-3 mt-0.5 flex-shrink-0">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                          </svg>
                          <div className="flex-1">
                            <h4 className="text-amber-800 font-medium text-sm mb-2">Email confirmation required</h4>
                            <p className="text-amber-700 text-sm mb-3">
                              Please check your email and click the confirmation link to activate your account.
                            </p>
                            
                            {/* Resend Button */}
                            <button
                              type="button"
                              onClick={handleResendConfirmation}
                              disabled={resendState === 'loading' || resendCooldown > 0}
                              className="inline-flex items-center px-3 py-2 border border-amber-300 bg-amber-100 text-amber-800 text-sm font-medium rounded-md hover:bg-amber-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {resendState === 'loading' ? (
                                <>
                                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-amber-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Sending...
                                </>
                              ) : resendCooldown > 0 ? (
                                `Resend in ${resendCooldown}s`
                              ) : (
                                'Resend confirmation email'
                              )}
                            </button>
                            
                            {/* Success/Error Messages */}
                            {resendState === 'success' && (
                              <p className="text-green-700 text-sm mt-2 flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Confirmation email sent successfully!
                              </p>
                            )}
                            
                            {resendState === 'error' && (
                              <p className="text-red-700 text-sm mt-2 flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Failed to send confirmation email. Please try again.
                              </p>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Login Button */}
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
                          Signing in...
                        </div>
                      ) : (
                        <div className="flex items-center justify-center">
                          <span>Sign In</span>
                        </div>
                      )}
                    </HoverButton>
                  </form>
                </Form>
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Sign Up Link */}
        <div className="mt-8 text-center">
          <p className="text-slate-600">
            Don&apos;t have an account?{' '}
            <Link 
              href="/signup" 
              className="text-orange-500 hover:text-orange-600 transition-colors font-medium"
            >
              Create an account
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

export default LoginPage;
