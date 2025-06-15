"use client";

import React, { useState } from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from 'next/link';
import { usePostHog } from "posthog-js/react";
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
  const posthog = usePostHog(); // Get PostHog instance

  // Initialize the form
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Handle form submission
  async function onSubmit(data: LoginFormValues) {
    setIsSubmitting(true);
    setError(null);
    
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
        throw error;
      }

      // If successful, Supabase's onAuthStateChange listener in AuthProvider
      // will handle the session update and redirection.
      console.log('Login successful - waiting for redirection');
      
      // Add a manual redirect as a backup
      // Sometimes the auth state change might not trigger immediately
      setTimeout(() => {
        window.location.href = '/dashboard';
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
              href="/waitlist" 
              className="text-orange-500 hover:text-orange-600 transition-colors font-medium"
            >
              Join the waitlist
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
