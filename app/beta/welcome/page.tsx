'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { CheckCircle, Zap, Clock, ArrowRight, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { usePostHog } from 'posthog-js/react';
import { BETA_ONBOARDING_COPY, FEATURE_FLAGS, getBetaVariantContent, shouldShowGiftCardIncentive } from '@/lib/constants/beta-onboarding';
import { trackEvent, ANALYTICS_EVENTS } from '@/lib/analytics/analytics';

export default function BetaWelcomePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const posthog = usePostHog();
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [betaVariant, setBetaVariant] = useState<'A' | 'B' | null>('A');

  // Beta access check - uses user metadata to determine access
  const hasBetaAccess = useCallback(() => {
    if (!user) return false;
    
    // Check if user has early access (which includes beta access)
    const hasEarlyAccess = user.user_metadata?.is_early_access === true;
    
    // Check if user has explicit beta access flag
    const hasBetaFlag = user.user_metadata?.beta_access === true;
    
    // For development/testing, allow any authenticated user
    if (process.env.NODE_ENV === 'development') {
      return true;
    }
    
    return hasEarlyAccess || hasBetaFlag;
  }, [user]);

  // Fetch beta variant from server (secure assignment)
  const fetchBetaVariant = useCallback(async () => {
    if (!user) return;

    try {
      const response = await fetch('/api/beta/variant', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const { variant } = await response.json();
        setBetaVariant(variant);
        
        // Track page view with assigned variant
        const urlParams = new URLSearchParams(window.location.search);
        trackEvent(posthog, ANALYTICS_EVENTS.BETA_STARTED, {
          user_id: user.id,
          beta_variant: variant,
          utm_source: urlParams.get('utm_source'),
          utm_campaign: urlParams.get('utm_campaign'),
          has_gift_card_incentive: shouldShowGiftCardIncentive(variant),
          variant_source: 'server_assigned'
        });
      } else {
        // Fallback to variant A if server assignment fails
        console.warn('Failed to fetch beta variant from server, using fallback');
        setBetaVariant('A');
        
        trackEvent(posthog, ANALYTICS_EVENTS.BETA_STARTED, {
          user_id: user.id,
          beta_variant: 'A',
          has_gift_card_incentive: shouldShowGiftCardIncentive('A'),
          variant_source: 'fallback'
        });
      }
    } catch (error) {
      console.error('Error fetching beta variant:', error);
      // Fallback to variant A
      setBetaVariant('A');
    }
  }, [user, posthog]);

  useEffect(() => {
    // Check feature flag
    if (!FEATURE_FLAGS.BETA_ONBOARDING_FLOW) {
      router.push('/beta');
      return;
    }

    // Redirect if not authenticated
    if (!isLoading && !user) {
      // Preserve UTM parameters and beta variant
      const searchParams = new URLSearchParams(window.location.search);
      const loginUrl = `/login?redirect=${encodeURIComponent('/beta/welcome')}`;
      
      // Preserve UTM and beta variant parameters
      if (searchParams.toString()) {
        router.push(`${loginUrl}&${searchParams.toString()}`);
      } else {
        router.push(loginUrl);
      }
      return;
    }

    // Check beta access (placeholder - implement based on your beta access logic)
    if (user && !hasBetaAccess()) {
      router.push('/beta?error=no_access');
      return;
    }

    // Get beta variant from server and track page view
    if (user) {
      fetchBetaVariant();
    }
  }, [user, isLoading, router, posthog, fetchBetaVariant, hasBetaAccess]);

  const handleStartDiagnostic = async () => {
    if (!user) return;

    setIsCreatingSession(true);
    setError(null);

    try {
      // Track click event
      trackEvent(posthog, ANALYTICS_EVENTS.START_DIAGNOSTIC_CLICKED, {
        user_id: user.id,
        beta_variant: betaVariant,
        has_gift_card_incentive: shouldShowGiftCardIncentive(betaVariant),
      });

      // Create diagnostic session
      const response = await fetch('/api/diagnostic/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          examKey: 'pmle',
          blueprintVersion: 'current',
          betaVariant: betaVariant,
          source: 'beta_welcome',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Diagnostic session creation failed:', errorData);
        throw new Error('Failed to create diagnostic session');
      }

      const { sessionId } = await response.json();

      // Redirect to diagnostic session
      router.push(`/diagnostic/${sessionId}`);
    } catch (err) {
      console.error('Error creating diagnostic session:', err);
      setError(BETA_ONBOARDING_COPY.errors.sessionCreateFailed);
    } finally {
      setIsCreatingSession(false);
    }
  };

  const handleSkipDiagnostic = () => {
    if (!user) return;

    // Track skip event
    trackEvent(posthog, ANALYTICS_EVENTS.SKIP_DIAGNOSTIC_CLICKED, {
      user_id: user.id,
      beta_variant: betaVariant,
      has_gift_card_incentive: shouldShowGiftCardIncentive(betaVariant),
    });

    // Redirect to dashboard
    router.push('/dashboard?from=beta_welcome');
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  // Not authenticated or no beta access - handled by useEffect redirects
  if (!user) {
    return null;
  }

  // Get variant-specific content
  const variantContent = getBetaVariantContent(betaVariant);
  const showGiftCard = shouldShowGiftCardIncentive(betaVariant);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Hero Section */}
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center gap-2 bg-green-100 border border-green-200 rounded-full px-4 py-2 mb-6">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm font-semibold text-green-700">
                Beta Access Confirmed
              </span>
            </div>
            
            <h1 className="text-4xl font-bold text-slate-900 mb-4">
              {BETA_ONBOARDING_COPY.welcome.headline}
            </h1>
            
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              {BETA_ONBOARDING_COPY.welcome.body}
            </p>
          </motion.div>

          {/* Progress Steps */}
          <motion.div
            className="mb-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Card>
              <CardHeader>
                <h2 className="text-xl font-semibold">Your Beta Journey</h2>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  {BETA_ONBOARDING_COPY.progressSteps.map((step, index) => (
                    <div key={step} className="flex items-center gap-3">
                      <div className={`
                        flex items-center justify-center w-8 h-8 rounded-full font-semibold text-sm
                        ${index === 0 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}
                      `}>
                        {index + 1}
                      </div>
                      <span className={`
                        ${index === 0 ? 'text-blue-600 font-semibold' : 'text-slate-600'}
                      `}>
                        {step}
                      </span>
                      {index < BETA_ONBOARDING_COPY.progressSteps.length - 1 && (
                        <ArrowRight className="h-4 w-4 text-slate-400 hidden md:block ml-4" />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Error Message */}
          {error && (
            <motion.div
              className="mb-8"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="border-red-200 bg-red-50">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    <p className="text-red-700">{error}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Main CTA Section */}
          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
              <CardContent className="pt-8 pb-8">
                <div className="max-w-2xl mx-auto">
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <Clock className="h-5 w-5 text-blue-600" />
                    <span className="text-sm font-medium text-blue-700">
                      {BETA_ONBOARDING_COPY.welcome.timeEstimate}
                    </span>
                  </div>
                  
                  <h3 className="text-2xl font-semibold text-slate-900 mb-4">
                    Ready to start?
                  </h3>
                  
                  <p className="text-slate-600 mb-8">
                    {variantContent.progressDescription}
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Button
                      onClick={handleStartDiagnostic}
                      disabled={isCreatingSession}
                      size="lg"
                      className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                    >
                      {isCreatingSession ? (
                        <>
                          <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                          Creating session...
                        </>
                      ) : (
                        <>
                          {variantContent.ctaPrimary}
                          <Zap className="ml-2 h-5 w-5" />
                        </>
                      )}
                    </Button>
                    
                    <Button
                      onClick={handleSkipDiagnostic}
                      variant="outline"
                      size="lg"
                      disabled={isCreatingSession}
                    >
                      {BETA_ONBOARDING_COPY.welcome.ctaSecondary}
                    </Button>
                  </div>
                  
                  {showGiftCard && variantContent.incentiveText && (
                    <div className="mt-6 p-4 bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🎁</span>
                        <p className="text-sm font-medium text-orange-700">
                          {variantContent.incentiveText}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </main>
  );
}