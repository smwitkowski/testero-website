"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePostHog } from "posthog-js/react";
import { motion } from "framer-motion";
import { supabase } from '@/lib/supabase/client';

type VerificationState = 'loading' | 'success' | 'error';

const VerifyEmailPage = () => {
  const [verificationState, setVerificationState] = useState<VerificationState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const router = useRouter();
  const posthog = usePostHog();

  useEffect(() => {
    const handleEmailConfirmation = async () => {
      try {
        // Track page view
        if (posthog) {
          posthog.capture('email_verification_page_viewed');
        }

        // Check if there's a hash in the URL containing the access token
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        
        if (!accessToken) {
          throw new Error('No verification token found in URL');
        }

        // Set the session using the tokens from the URL
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || '',
        });

        if (error) {
          throw error;
        }

        if (data.session && data.user) {
          // Track successful email confirmation
          if (posthog) {
            posthog.capture('email_confirmed', {
              user_id: data.user.id,
              email: data.user.email,
            });
          }

          setVerificationState('success');
          
          // Auto-redirect to dashboard after 3 seconds
          setTimeout(() => {
            setIsRedirecting(true);
            router.push('/dashboard');
          }, 3000);
        } else {
          throw new Error('Failed to establish session after verification');
        }

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Email verification failed';
        setError(errorMessage);
        setVerificationState('error');

        // Track verification error
        if (posthog) {
          posthog.capture('email_verification_error', {
            error_message: errorMessage,
          });
        }
      }
    };

    handleEmailConfirmation();
  }, [router, posthog]);

  const handleManualRedirect = () => {
    setIsRedirecting(true);
    router.push('/dashboard');
  };

  const handleReturnToLogin = () => {
    router.push('/login');
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
              {verificationState === 'loading' && 'Verifying Your Email'}
              {verificationState === 'success' && 'Email Verified!'}
              {verificationState === 'error' && 'Verification Failed'}
            </h1>
            <p className="text-slate-600">
              {verificationState === 'loading' && 'Please wait while we confirm your email address...'}
              {verificationState === 'success' && 'Your account has been successfully verified'}
              {verificationState === 'error' && 'There was a problem verifying your email'}
            </p>
          </div>

          {/* Content */}
          <div className="px-6 py-8">
            {verificationState === 'loading' && (
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
                <p className="text-slate-600">Confirming your email address...</p>
              </motion.div>
            )}

            {verificationState === 'success' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center space-y-6"
              >
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                  <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                
                <div className="space-y-3">
                  <h3 className="text-lg font-medium text-slate-900">Welcome to Testero!</h3>
                  <p className="text-slate-600">
                    Your email has been verified and your account is now active.
                  </p>
                  
                  {isRedirecting ? (
                    <div className="bg-blue-50 border border-blue-100 rounded-md px-4 py-3">
                      <p className="text-blue-700 text-sm flex items-center justify-center">
                        <svg 
                          className="animate-spin h-4 w-4 mr-2" 
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
                        Redirecting to your dashboard...
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-slate-500 text-sm">
                        You&apos;ll be automatically redirected to your dashboard in a few seconds.
                      </p>
                      
                      <button
                        onClick={handleManualRedirect}
                        className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-6 py-3 rounded-md text-base font-semibold shadow-md transition-all"
                      >
                        Continue to Dashboard
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {verificationState === 'error' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center space-y-6"
              >
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                  <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                
                <div className="space-y-3">
                  <h3 className="text-lg font-medium text-slate-900">Verification Failed</h3>
                  
                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3">
                      <p className="text-red-600 text-sm font-medium">
                        {error}
                      </p>
                    </div>
                  )}
                  
                  <div className="space-y-3">
                    <p className="text-slate-600 text-sm">
                      The verification link may have expired or been used already. Please try signing up again or contact support if the problem persists.
                    </p>
                    
                    <button
                      onClick={handleReturnToLogin}
                      className="w-full bg-gradient-to-r from-slate-500 to-slate-600 hover:from-slate-600 hover:to-slate-700 text-white px-6 py-3 rounded-md text-base font-semibold shadow-md transition-all"
                    >
                      Return to Login
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

export default VerifyEmailPage;