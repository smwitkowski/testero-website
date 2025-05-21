"use client";

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePostHog } from "posthog-js/react";
import { supabase } from '@/lib/supabase/client';
import { HoverButton } from "@/components/ui/hover-button";
import { motion } from "framer-motion";

// Loading component for Suspense fallback
const VerifyEmailLoading = () => (
  <div className="py-8 text-center">
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
    <p className="text-slate-600">Loading verification page...</p>
  </div>
);

// Main verification component that uses useSearchParams
const VerifyEmailContent = () => {
  // States
  const [isVerifying, setIsVerifying] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const posthog = usePostHog();

  // Process verification on page load
  useEffect(() => {
    const verifyEmail = async () => {
      try {
        // Track page view in PostHog
        if (posthog) {
          posthog.capture('email_verification_page_viewed');
        }

        // Get session to check if we have a valid user
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          throw new Error(sessionError.message);
        }

        // If we have a user, they've clicked the verification link
        if (sessionData?.session?.user) {
          const user = sessionData.session.user;
          // Handle potential undefined email by defaulting to null
          setEmail(user.email || null);
          
          // Check if the email is already verified
          if (user.email_confirmed_at) {
            setIsVerified(true);
            
            // Track success in PostHog
            if (posthog) {
              posthog.capture('email_verification_already_verified', {
                email: user.email,
              });
            }
          } else {
            // For email verification with magic link, Supabase handles the verification
            // automatically when the user follows the link, so we just need to check
            // if the user exists and the session is valid
            
            // Refresh the session to ensure we have the latest user data
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
            
            if (refreshError) {
              throw new Error(refreshError.message);
            }
            
            // Check if email is now verified
            if (refreshData?.user?.email_confirmed_at) {
              setIsVerified(true);
              
              // Track success in PostHog
              if (posthog) {
                posthog.capture('email_verification_success', {
                  email: refreshData.user.email,
                });
              }
            } else {
              // If still not verified, something went wrong
              throw new Error("Email verification failed. Please try again or request a new verification link.");
            }
          }
        } else {
          // No session found - could be an expired token or invalid link
          throw new Error("Invalid or expired verification link. Please request a new verification email.");
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Verification failed. Please try again.";
        setError(errorMessage);
        setIsVerified(false);
        
        // Track error in PostHog
        if (posthog) {
          posthog.capture('email_verification_error', {
            error_message: errorMessage,
          });
        }
      } finally {
        setIsVerifying(false);
      }
    };

    verifyEmail();
  }, [posthog, searchParams, router]);

  // Handle request for new verification email
  const handleResendVerification = async () => {
    if (!email) return;
    
    try {
      // Track resend request in PostHog
      if (posthog) {
        posthog.capture('email_verification_resend_requested', {
          email,
        });
      }
      
      // Call Supabase API to resend verification email
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email,
      });

      if (resendError) {
        throw new Error(resendError.message);
      }
      
      // Add a temporary success message
      setError(null);
      alert("A new verification email has been sent. Please check your inbox.");
      
      // Track success in PostHog
      if (posthog) {
        posthog.capture('email_verification_resend_success', {
          email,
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to resend verification email. Please try again.";
      setError(errorMessage);
      
      // Track error in PostHog
      if (posthog) {
        posthog.capture('email_verification_resend_error', {
          email,
          error_message: errorMessage,
        });
      }
    }
  };

  return (
    <div className="px-6 py-8">
      {isVerifying ? (
        // Loading State
        <div className="py-8 text-center">
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
          <p className="text-slate-600">Verifying your email address...</p>
        </div>
      ) : isVerified ? (
        // Success State
        <div className="space-y-6">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">Email Verified Successfully</h3>
            <p className="text-slate-600 mb-4">
              Your email address has been verified. You can now access all features of your account.
            </p>
          </div>

          {/* Login Button */}
          <Link 
            href="/login" 
            className="block w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-6 py-3 rounded-md text-base font-semibold shadow-md text-center"
          >
            Continue to Login
          </Link>
        </div>
      ) : (
        // Error State
        <div className="space-y-6">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">Verification Failed</h3>
            <p className="text-slate-600 mb-4">
              {error || "We couldn't verify your email address. The verification link may have expired or is invalid."}
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div
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
            </div>
          )}

          {/* Resend Button */}
          {email && (
            <HoverButton
              onClick={handleResendVerification}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 px-6 py-3 rounded-md text-base font-semibold shadow-sm text-center"
            >
              Resend Verification Email
            </HoverButton>
          )}

          {/* Login Link */}
          <div className="text-center">
            <p className="text-slate-600 text-sm">
              Or return to login
            </p>
            <Link 
              href="/login" 
              className="mt-2 inline-block text-orange-500 hover:text-orange-600 transition-colors font-medium"
            >
              Go to Login
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

// Main component with Suspense boundary
const VerifyEmailPage = () => {
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
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-2">Email Verification</h1>
            <p className="text-slate-600">Confirming your email address</p>
          </div>

          {/* Content Container with Suspense */}
          <Suspense fallback={<VerifyEmailLoading />}>
            <VerifyEmailContent />
          </Suspense>
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

export default VerifyEmailPage;
