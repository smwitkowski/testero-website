'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { CheckCircle, Shield, Star, Clock, Users, Zap, Gift, AlertTriangle, MessageCircle } from 'lucide-react';
import { JsonLd } from './page.metadata';
import { motion } from 'framer-motion';

// Component interfaces for type safety
interface BetaSectionProps {
  children: React.ReactNode;
  testId?: string;
  className?: string;
}

interface BetaHeadingProps {
  level: 1 | 2 | 3;
  children: React.ReactNode;
  className?: string;
}

// Reusable navigation handler to avoid duplication
const useNavigateToBeta = () => {
  const router = useRouter();
  
  return () => {
    const betaOnboardingEnabled = process.env.NEXT_PUBLIC_BETA_ONBOARDING_FLOW === 'true';
    if (betaOnboardingEnabled) {
      router.push('/beta/welcome');
    } else {
      router.push('/dashboard');
    }
  };
};

// Reusable section component
const BetaSection: React.FC<BetaSectionProps> = ({ 
  children, 
  testId, 
  className = "" 
}) => (
  <section 
    data-testid={testId} 
    className={`py-8 px-4 ${className}`}
  >
    {children}
  </section>
);

// Reusable heading component with proper accessibility
const BetaHeading: React.FC<BetaHeadingProps> = ({ 
  level, 
  children, 
  className = "" 
}) => {
  const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements;
  const defaultClasses = level === 1 
    ? "text-3xl font-bold" 
    : "text-2xl font-semibold";
    
  return (
    <HeadingTag className={`${defaultClasses} ${className}`}>
      {children}
    </HeadingTag>
  );
};

// Hero section component with enhanced styling and animations
const HeroSection: React.FC = () => (
  <BetaSection className="text-center bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-16">
    <div className="max-w-4xl mx-auto">
      <motion.div 
        className="inline-flex items-center gap-2 bg-yellow-400/20 backdrop-blur-sm border border-yellow-400/40 rounded-full px-4 py-2 mb-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <motion.div
          animate={{ rotate: [0, 15, -15, 0] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
        >
          <Star className="h-4 w-4 text-yellow-300" />
        </motion.div>
        <span className="text-sm font-semibold text-yellow-100">
          Limited Beta Spots Available
        </span>
      </motion.div>
      
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
      >
        <BetaHeading level={1} className="text-white mb-4">
          Welcome to the Testero Beta - Here&apos;s What You Get
        </BetaHeading>
      </motion.div>
      
      <motion.p 
        className="text-lg text-blue-100 max-w-2xl mx-auto mb-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
      >
        You&apos;re in! Let&apos;s get you started with everything you need to succeed in the beta. Here&apos;s exactly what you&apos;ll get, what we&apos;re asking from you, and how we&apos;ll use your data.
      </motion.p>
      
      <motion.div 
        className="flex items-center justify-center gap-2 text-sm text-blue-200/80"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.6, ease: "easeOut" }}
      >
        <Users className="h-4 w-4" />
        <span>100+ early testers have already joined</span>
      </motion.div>
    </div>
  </BetaSection>
);

// CTA section component with enhanced styling and multiple buttons
const CtaSection: React.FC = () => {
  const handleCtaClick = useNavigateToBeta();
  
  return (
    <BetaSection className="text-center bg-gradient-to-b from-slate-50 to-white py-16">
      <div className="max-w-4xl mx-auto">
        <BetaHeading level={2} className="mb-4">
          Ready to Start Your Beta Journey?
        </BetaHeading>
        <p className="text-slate-600 mb-6 max-w-2xl mx-auto">
          Join 100+ early testers already using Testero to accelerate their PMLE preparation. Limited beta spots close soon.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
          <Button
            data-testid="cta-button"
            type="button"
            size="lg"
            tone="accent"
            iconRight={<Zap className="h-5 w-5" />}
            onClick={handleCtaClick}
          >
            Start Your Beta Now
          </Button>
          <Button variant="solid" tone="neutral" size="lg" iconRight={<MessageCircle className="h-5 w-5" />}> 
            Read Details
          </Button>
        </div>
        <p className="text-sm text-slate-600">
          ✓ No credit card required ✓ Full access to beta features ✓ Direct founder support ✓ <span className="font-semibold text-orange-600">Limited time offer</span>
        </p>
      </div>
    </BetaSection>
  );
};

// Sticky CTA component for mobile
const StickyMobileCTA: React.FC = () => {
  const handleCtaClick = useNavigateToBeta();
  
  return (
    <motion.div
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-50 md:hidden shadow-lg"
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, delay: 1 }}
    >
      <Button
        data-testid="sticky-mobile-cta"
        type="button"
        size="lg"
        tone="accent"
        fullWidth
        iconRight={<Zap className="h-5 w-5" />}
        onClick={handleCtaClick}
      >
        Start Beta Now
      </Button>
    </motion.div>
  );
};

export default function BetaPage(): React.ReactElement {
  const handleCtaClick = useNavigateToBeta();
  
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white pb-20 md:pb-0">
      {/* Add JSON-LD structured data */}
      <JsonLd />
      
      <HeroSection />

      <BetaSection testId="beta-benefits">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
          >
            <BetaHeading level={2} className="text-center mb-12">What You&apos;ll Get in the Beta</BetaHeading>
          </motion.div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Card>
                <CardHeader>
                  <BetaHeading level={3} className="flex items-center gap-2">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                    Full Access to Core Features
                  </BetaHeading>
                </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <strong>Diagnostic Assessment</strong> - Identify exactly where to focus to pass the PMLE with our 25-30 minute assessment mapped to Google&apos;s official blueprint
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Users className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <strong>Personalized Study Plan</strong> - Skip generic study guides with a custom plan that targets your specific knowledge gaps per domain and topic
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Zap className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <strong>Question Bank Access</strong> - Practice with real PMLE-style questions that mirror the actual exam format (expanding weekly with new content)
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Shield className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <strong>Progress Tracking</strong> - Never lose momentum with detailed insights into your completion rate, time investment, and priority focus areas
                    </div>
                  </li>
                </ul>
              </CardContent>
              </Card>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <Card className="border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-yellow-50">
                <CardHeader>
                  <BetaHeading level={3} className="flex items-center gap-2">
                    <Star className="h-6 w-6 text-orange-600" />
                    Beta-Only Perks
                  </BetaHeading>
                </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <MessageCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <strong>Direct Feedback Loop</strong> - Direct line to the founder for questions or suggestions
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Zap className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <strong>Early Access to New Features</strong> - See new features (practice sets, refined recommendations) first
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Users className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <strong>Founder Support</strong> - Personal help and guidance throughout your beta experience
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Gift className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <strong>Gift Card Incentive</strong> - Earn a $20 gift card by completing the diagnostic and feedback form
                    </div>
                  </li>
                </ul>
              </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </BetaSection>

      {/* Mid-page CTA after features */}
      <BetaSection className="bg-gradient-to-r from-blue-50 to-cyan-50 py-12">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h3 className="text-xl font-semibold mb-4">Convinced? Start Your Beta Now</h3>
            <p className="text-slate-600 mb-6">Don&apos;t wait - join the limited beta while spots are still available</p>
            <Button
              data-testid="mid-cta-button"
              type="button"
              size="lg"
              tone="accent"
              iconRight={<Zap className="h-5 w-5" />}
              onClick={handleCtaClick}
            >
              Join Beta Now
            </Button>
          </motion.div>
        </div>
      </BetaSection>

      <BetaSection testId="limitations" className="warning">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6 }}
          >
            <Card className="border-2 border-yellow-300 bg-gradient-to-br from-yellow-50 to-orange-50">
            <CardHeader>
              <BetaHeading level={2} className="flex items-center gap-2">
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
                Current Limitations (Beta Transparency)
              </BetaHeading>
              <p className="text-slate-600">We&apos;re building in the open and want you to know exactly where we stand. Here&apos;s what we&apos;re actively improving:</p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <strong>Growing question bank (17% complete)</strong> - Help us prioritize which topics to add next as we build toward 500+ questions
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <strong>Learning study patterns</strong> - Help us perfect recommendations by sharing what study approaches work best for you
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <strong>Building analytics dashboard</strong> - Tell us which performance insights matter most to you
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <strong>Possible bugs</strong> - As a beta product, you may encounter issues or unexpected behavior
                  </div>
                </li>
              </ul>
            </CardContent>
            </Card>
            
            <motion.div 
              className="mt-6 text-center"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <p className="text-sm text-slate-500 flex items-center justify-center gap-2">
                <Zap className="h-4 w-4 text-blue-600" />
                We&apos;re actively improving these weekly based on your feedback
              </p>
            </motion.div>
          </motion.div>
        </div>
      </BetaSection>

      <BetaSection testId="expectations">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <BetaHeading level={2} className="flex items-center gap-2">
                <Users className="h-6 w-6 text-blue-600" />
                What We Expect from You
              </BetaHeading>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <strong>Kick off your beta journey within the first week</strong> to make the most of it
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <MessageCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <strong>Share your experience</strong> - tell us what works, what doesn&apos;t, and what you&apos;d love to see
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <strong>Help us improve</strong> by reporting any issues you encounter (screenshots welcome!)
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Star className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <strong>Optional calls</strong> with the founder to discuss your experience and suggestions
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </BetaSection>

      <BetaSection testId="target-audience">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <BetaHeading level={2} className="flex items-center gap-2">
                <Users className="h-6 w-6 text-purple-600" />
                Who This Beta Is For
              </BetaHeading>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    Professionals preparing for <strong>PMLE exam preparation</strong>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Zap className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <strong>Early adopters</strong> who enjoy trying new products and providing feedback
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Star className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    People who want to actively shape a product they&apos;ll use
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <MessageCircle className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                  <div>
                    Anyone willing to provide constructive feedback on their learning experience
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </BetaSection>

      <BetaSection testId="privacy">
        <div className="max-w-4xl mx-auto">
          <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-blue-50">
            <CardHeader>
              <BetaHeading level={2} className="flex items-center gap-2">
                <Shield className="h-6 w-6 text-green-600" />
                Data & Privacy
              </BetaHeading>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <strong>Secure storage</strong> of all your data using industry-standard encryption
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <strong>No third-party sharing without consent</strong> - we never sell or share your data
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Users className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <strong>Deletion on request</strong> - you can request complete data deletion at any time
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Star className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    Transparent data usage for product improvement only
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </BetaSection>

      <BetaSection testId="getting-started">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <BetaHeading level={2} className="flex items-center gap-2">
                <Zap className="h-6 w-6 text-orange-600" />
                How to Get Started
              </BetaHeading>
            </CardHeader>
            <CardContent>
              <ol className="space-y-4">
                <li className="flex items-start gap-4">
                  <div className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full font-bold text-sm flex-shrink-0">
                    1
                  </div>
                  <div>
                    <strong>Click invite link</strong> from your beta invitation email
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full font-bold text-sm flex-shrink-0">
                    2
                  </div>
                  <div>
                    <strong>Sign in</strong> with your email or <strong>create account</strong> if you don&apos;t have one
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full font-bold text-sm flex-shrink-0">
                    3
                  </div>
                  <div>
                    <strong>Start diagnostic</strong> assessment (~<strong>15</strong>–<strong>20</strong> <strong>minutes</strong>)
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full font-bold text-sm flex-shrink-0">
                    4
                  </div>
                  <div>
                    <strong>Review results</strong> and begin your personalized study journey
                  </div>
                </li>
              </ol>
            </CardContent>
          </Card>
        </div>
      </BetaSection>

      <CtaSection />
      
      {/* Sticky mobile CTA */}
      <StickyMobileCTA />
    </main>
  );
}