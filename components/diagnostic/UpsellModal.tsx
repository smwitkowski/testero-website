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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[color:color-mix(in oklch, var(--foreground) 72%, transparent)] p-4 transition-opacity"
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
        className="relative w-full max-w-lg transform rounded-2xl border border-[color:var(--divider-color)] bg-[color:var(--surface-elevated)] p-6 opacity-100 shadow-xl transition-all duration-200 sm:p-8"
        style={{
          animation: isOpen ? 'modalEnter 200ms ease-out' : undefined,
        }}
      >
        {/* Close Button */}
        <button
          ref={closeButtonRef}
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-[color:var(--surface-muted)] hover:text-foreground focus:outline-none focus:ring-2 focus:ring-[color:var(--tone-info)] focus:ring-offset-2"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <h2 id="upsell-title" className="pr-8 text-2xl font-semibold tracking-tight text-foreground">
          {config.title}
        </h2>

        {/* Value Bullets */}
        <div id="upsell-description" className="mt-4 space-y-3">
          <div className="flex items-start gap-3">
            <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-[color:var(--tone-info)]" />
            <div>
              <div className="font-medium text-foreground">Personalized Study Plan</div>
              <div className="text-sm text-muted-foreground">AI-powered path based on results</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Target className="mt-0.5 h-5 w-5 flex-shrink-0 text-[color:var(--tone-info)]" />
            <div>
              <div className="font-medium text-foreground">Unlimited Practice Questions</div>
              <div className="text-sm text-muted-foreground">2,000+ updated weekly</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Award className="mt-0.5 h-5 w-5 flex-shrink-0 text-[color:var(--tone-info)]" />
            <div>
              <div className="font-medium text-foreground">Pass Rate Guarantee</div>
              <div className="text-sm text-muted-foreground">92% first-attempt pass rate</div>
            </div>
          </div>
        </div>

        {/* Promo Box */}
        {config.promo && (
          <div className="mt-4 rounded-xl border border-[color:var(--tone-accent)] bg-[color:var(--tone-accent-surface)] px-3 py-2 text-sm text-[color:var(--tone-accent)]">
            {config.promo}
          </div>
        )}

        {/* Primary CTA */}
        <Button
          onClick={onCTAClick}
          tone="accent"
          size="lg"
          fullWidth
          className="mt-5 rounded-xl"
        >
          Start 14-Day Free Trial
        </Button>

        {/* Secondary Action */}
        <Button
          onClick={onContinueWithoutTrial}
          variant="outline"
          tone="neutral"
          size="md"
          fullWidth
          className="mt-3 rounded-lg"
        >
          Continue without trial
        </Button>

        {/* Trust Line */}
        <p className="mt-2 text-center text-xs text-muted-foreground">
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