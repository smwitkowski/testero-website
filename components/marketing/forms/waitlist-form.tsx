"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { usePostHog } from "posthog-js/react"; // Import usePostHog
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { HoverButton } from "@/components/marketing/buttons/hover-button";
import { motion, AnimatePresence } from "framer-motion";

// Define the form schema with zod validation
const formSchema = z.object({
  email: z
    .string()
    .min(1, { message: "Email is required" })
    .email({ message: "Must be a valid email address" })
    .transform((val) => val.toLowerCase().trim()),
  examType: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

// Define props with optional className and onSuccess callback
interface WaitlistFormProps {
  className?: string;
  buttonText?: string;
  includeExamDropdown?: boolean;
  ctaLocation?: string; // Add optional prop for CTA location context
  onSuccess?: (data: FormValues) => void;
}

export function WaitlistForm({
  className = "",
  buttonText = "Join the Waitlist & Get 30% Off",
  includeExamDropdown = false,
  ctaLocation = "unknown", // Default location if not provided
  onSuccess,
  ...props
}: WaitlistFormProps) {
  // Form submission states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const posthog = usePostHog(); // Get PostHog instance

  // Initialize the form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      examType: "",
    },
  });

  // Handle form submission
  async function onSubmit(data: FormValues) {
    setIsSubmitting(true);
    setError(null);

    try {
      // Submit to API endpoint
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { error?: string };
        throw new Error(errorData.error || "Failed to submit");
      }

      // Handle success
      setIsSuccess(true);

      // Capture PostHog event
      if (posthog) {
        posthog.capture("waitlist_joined", {
          email: data.email,
          examType: data.examType || "not_selected", // Include exam type if present
        });
      }

      // Call the success callback if provided
      if (onSuccess) {
        onSuccess(data);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Something went wrong. Please try again.";
      // Handle error
      setError(errorMessage);
      // Capture PostHog error event
      if (posthog) {
        posthog.capture("waitlist_form_submission_error", {
          error_message: errorMessage,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  // Exam type options
  const examOptions = [
    { value: "", label: "Select your main certification interest (optional)" },
    { value: "gcp", label: "Google Cloud (GCP)" },
    { value: "aws", label: "Amazon Web Services (AWS)" },
    { value: "azure", label: "Microsoft Azure" },
    { value: "multiple", label: "Multiple cloud platforms" },
    { value: "other", label: "Other certifications" },
  ];

  return (
    <div className={className} {...props}>
      <AnimatePresence mode="wait">
        {!isSuccess ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            key="form"
          >
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <div className="relative">
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="Enter your email address"
                            className={`px-3 sm:px-4 py-2.5 sm:py-3 min-h-[44px] text-base sm:text-lg rounded-md transition-all duration-300 border-2 ${
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
                              // Track form interaction start
                              if (posthog) {
                                posthog.capture("waitlist_form_interaction_start");
                              }
                            }}
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

                {includeExamDropdown && (
                  <FormField
                    control={form.control}
                    name="examType"
                    render={({ field, fieldState }) => (
                      <FormItem>
                        <div className="relative">
                          <FormControl>
                            <select
                              className={`px-3 sm:px-4 py-2.5 sm:py-3 min-h-[44px] rounded-md w-full text-base sm:text-lg text-slate-600 bg-white appearance-none transition-all duration-300 border-2 ${
                                fieldState.error
                                  ? "border-red-400 bg-red-50"
                                  : "border-slate-300 focus:border-orange-400 focus:ring focus:ring-orange-200 focus:ring-opacity-50"
                              }`}
                              disabled={isSubmitting}
                              aria-label="Select your main certification interest"
                              {...field}
                            >
                              {examOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </FormControl>
                          {/* Custom dropdown arrow */}
                          <div
                            className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500"
                            aria-hidden="true"
                          >
                            <svg
                              className="h-5 w-5"
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </div>
                        </div>
                        <FormMessage className="text-left mt-1 font-medium" />
                      </FormItem>
                    )}
                  />
                )}

                <HoverButton
                  className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-full text-base sm:text-xl font-semibold shadow-lg w-full transition-all"
                  type="submit"
                  disabled={isSubmitting}
                  aria-busy={isSubmitting ? "true" : "false"}
                  onClick={() => {
                    // Track CTA click intent using the location prop
                    if (posthog) {
                      posthog.capture("cta_click", { cta_location: ctaLocation });
                    }
                  }}
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
                      Processing...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <span>{buttonText}</span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                        className="w-5 h-5"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M8.25 4.5l7.5 7.5-7.5 7.5"
                        />
                      </svg>
                    </div>
                  )}
                </HoverButton>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-50 border border-red-200 rounded-md px-4 py-3 text-center"
                    role="alert"
                    aria-live="assertive"
                  >
                    <p className="text-red-600 font-medium flex items-center justify-center">
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
              </form>
            </Form>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            key="success"
            className="bg-green-50 p-6 rounded-lg border border-green-200 text-center"
            role="status"
            aria-live="polite"
          >
            <div className="flex flex-col items-center space-y-4">
              <div className="bg-green-100 p-3 rounded-full" aria-hidden="true">
                <svg
                  className="h-8 w-8 text-green-600"
                  xmlns="http://www.w3.org/2000/svg"
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
              </div>
              <h3 className="text-xl font-semibold text-slate-800">You&apos;re on the list!</h3>
              <p className="text-slate-600">
                Thanks for joining the Testero waitlist. We&apos;ll notify you when beta access is
                available in July 2025.
              </p>
              <p className="text-green-600 font-medium">
                Your 30% lifetime discount has been reserved.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
