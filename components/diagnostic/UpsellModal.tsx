import React, { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { X, CheckCircle, Target, Award } from 'lucide-react';
import { UpsellVariant, UpsellTrigger } from '@/hooks/useUpsell';

interface UpsellModalProps {
  isOpen: boolean;
  variant: UpsellVariant;
  trigger: UpsellTrigger | null;
  onClose: () => void;
  onCTAClick: () => void;
  onContinueWithoutTrial: () => void;
}

interface VariantConfig {
  title: string;
  promo?: string;
}

const variantConfigs: Record<UpsellVariant, VariantConfig> = {
  foundation: {
    title: 'Build a Strong Foundation',
    promo: 'Get the targeted practice you need to pass',
  },
  almost: {
    title: 'Turn "almost" into a pass',
    promo: 'Close the gap with personalized study',
  },
  polish: {
    title: 'Polish for the win',
    promo: 'Perfect your knowledge for exam day',
  },
};

export const UpsellModal: React.FC<UpsellModalProps> = ({
  isOpen,
  variant,
  trigger,
  onClose,
  onCTAClick,
  onContinueWithoutTrial,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const config = variantConfigs[variant];

  // Focus management
  useEffect(() => {
    if (isOpen) {
      // Store the previously focused element
      previousActiveElement.current = document.activeElement as HTMLElement;
      
      // Focus the close button when modal opens
      // Use requestAnimationFrame for more reliable timing
      const focusCloseButton = () => {
        requestAnimationFrame(() => {
          if (closeButtonRef.current && isOpen) {
            closeButtonRef.current.focus();
          }
        });
      };
      focusCloseButton();
      
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
      
      return () => {
        document.body.style.overflow = '';
      };
    } else {
      // Restore focus when modal closes
      if (previousActiveElement.current) {
        requestAnimationFrame(() => {
          previousActiveElement.current?.focus();
        });
      }
    }
  }, [isOpen]);

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;
      
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
      
      // Focus trap
      if (event.key === 'Tab' && dialogRef.current) {
        const focusableElements = dialogRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
        
        if (event.shiftKey) {
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 transition-opacity z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
      aria-hidden="true"
    >
      {/* Desktop Modal */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upsell-title"
        aria-describedby="upsell-description"
        data-trigger={trigger}
        className="relative w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-xl p-6 sm:p-8 transform transition-all duration-200 scale-100 opacity-100"
        style={{
          animation: isOpen ? 'modalEnter 200ms ease-out' : undefined,
        }}
      >
        {/* Close Button */}
        <button
          ref={closeButtonRef}
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <h2 id="upsell-title" className="text-2xl font-semibold tracking-tight text-slate-900 pr-8">
          {config.title}
        </h2>

        {/* Value Bullets */}
        <div id="upsell-description" className="mt-4 space-y-3">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-medium text-slate-900">Personalized Study Plan</div>
              <div className="text-sm text-slate-600">AI-powered path based on results</div>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <Target className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-medium text-slate-900">Unlimited Practice Questions</div>
              <div className="text-sm text-slate-600">2,000+ updated weekly</div>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <Award className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-medium text-slate-900">Pass Rate Guarantee</div>
              <div className="text-sm text-slate-600">92% first-attempt pass rate</div>
            </div>
          </div>
        </div>

        {/* Promo Box */}
        {config.promo && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {config.promo}
          </div>
        )}

        {/* Primary CTA */}
        <Button
          onClick={onCTAClick}
          className="mt-5 w-full h-12 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/30 transition-colors"
        >
          Start 14-Day Free Trial
        </Button>

        {/* Secondary Action */}
        <Button
          onClick={onContinueWithoutTrial}
          variant="outline"
          className="mt-3 w-full h-10 rounded-lg border border-slate-200 text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Continue without trial
        </Button>

        {/* Trust Line */}
        <p className="mt-2 text-center text-xs text-slate-500">
          No credit card required • Cancel anytime
        </p>
      </div>

      {/* Mobile Bottom Sheet - Show only on mobile */}
      <style jsx>{`
        @keyframes modalEnter {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        @media (max-width: 640px) {
          .relative {
            position: fixed !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            max-width: none !important;
            border-radius: 1rem 1rem 0 0 !important;
            padding-bottom: env(safe-area-inset-bottom, 0) !important;
            transform: translateY(0) !important;
            animation: slideUp 200ms ease-out !important;
          }
        }
        
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};