"use client";

import React, { useState } from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from 'next/link';
import { usePostHog } from "posthog-js/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from '@/lib/supabase/client';
import { colorSemantic } from "@/lib/design-system";

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

      const { error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
      });

      if (error) {
        throw error;
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
    <div className="min-h-screen pt-24 pb-12 md:pt-32 flex flex-col items-center justify-start" style={{ background: `linear-gradient(to bottom, ${colorSemantic.background.default}, ${colorSemantic.primary[100]})` }}>
      <div className="w-full max-w-md px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card variant="elevated" className="overflow-hidden">
            <CardHeader className="text-center border-b" style={{ backgroundColor: colorSemantic.background.default, borderColor: colorSemantic.border.default }}>
              <h1 className="text-2xl md:text-3xl font-bold mb-2" style={{ color: colorSemantic.text.primary }}>Create your account</h1>
              <p style={{ color: colorSemantic.text.secondary }}>Sign up to start practicing with Testero</p>
            </CardHeader>

            <CardContent>
            <AnimatePresence mode="wait">
              {!isSubmitted ? (
                <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                                      ? 'border-red-400 bg-red-50'
                                      : fieldState.isDirty && !fieldState.error
                                        ? 'border-green-400 bg-green-50'
                                        : 'border-slate-300 focus:border-orange-400 focus:ring focus:ring-orange-200 focus:ring-opacity-50'
                                  }`}
                                  disabled={isSubmitting}
                                  autoComplete="email"
                                  autoFocus
                                  aria-required="true"
                                  aria-invalid={fieldState.error ? 'true' : 'false'}
                                  {...field}
                                />
                              </FormControl>
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
                                      ? 'border-red-400 bg-red-50'
                                      : fieldState.isDirty && !fieldState.error
                                        ? 'border-green-400 bg-green-50'
                                        : 'border-slate-300 focus:border-orange-400 focus:ring focus:ring-orange-200 focus:ring-opacity-50'
                                  }`}
                                  disabled={isSubmitting}
                                  autoComplete="new-password"
                                  aria-required="true"
                                  aria-invalid={fieldState.error ? 'true' : 'false'}
                                  {...field}
                                />
                              </FormControl>
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

                      <Button
                        className="w-full text-base"
                        size="lg"
                        type="submit"
                        disabled={isSubmitting}
                        aria-busy={isSubmitting ? 'true' : 'false'}
                      >
                        {isSubmitting ? (
                          <div className="flex items-center justify-center">
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Signing up...
                          </div>
                        ) : (
                          <div className="flex items-center justify-center">
                            <span>Sign Up</span>
                          </div>
                        )}
                      </Button>
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
                  <h3 className="text-lg font-medium" style={{ color: colorSemantic.text.primary }}>Check your email</h3>
                  <p style={{ color: colorSemantic.text.secondary }}>We&#39;ve sent a confirmation link to {form.getValues().email}. Please follow the instructions to complete your registration.</p>
                </motion.div>
              )}
            </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>

        <div className="mt-8 text-center">
          <p style={{ color: colorSemantic.text.secondary }}>
            Already have an account?{' '}
            <Link href="/login" className="hover:opacity-80 transition-colors font-medium" style={{ color: colorSemantic.text.accent }}>
              Sign in
            </Link>
          </p>
        </div>

        <div className="absolute inset-0 opacity-10 pointer-events-none" aria-hidden="true">
          <div className="absolute top-0 left-1/4 w-64 h-64 rounded-full bg-blue-500 mix-blend-multiply blur-3xl"></div>
          <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full bg-orange-500 mix-blend-multiply blur-3xl"></div>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
