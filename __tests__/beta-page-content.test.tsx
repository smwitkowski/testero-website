import { render, screen } from '@testing-library/react';
import { describe, it, expect } from '@jest/globals';
import BetaPage from '@/app/beta/page';

describe('Beta Page Content', () => {
  describe('Beta Benefits Section', () => {
    it('displays all required core feature categories', () => {
      render(<BetaPage />);
      
      const benefitsSection = screen.getByTestId('beta-benefits');
      
      // Core features that should be mentioned
      expect(benefitsSection).toHaveTextContent('Diagnostic Assessment');
      expect(benefitsSection).toHaveTextContent('Personalized Study Plan');
      expect(benefitsSection).toHaveTextContent('Question Bank Access');
      expect(benefitsSection).toHaveTextContent('Progress Tracking');
    });

    it('shows beta-only perks with proper emphasis', () => {
      render(<BetaPage />);
      
      const benefitsSection = screen.getByTestId('beta-benefits');
      
      // Beta-exclusive perks
      expect(benefitsSection).toHaveTextContent('Direct Feedback Loop');
      expect(benefitsSection).toHaveTextContent('Early Access to New Features');
      expect(benefitsSection).toHaveTextContent('Founder Support');
      expect(benefitsSection).toHaveTextContent('Gift Card Incentive');
    });

    it('organizes benefits into core features and beta perks subsections', () => {
      render(<BetaPage />);
      
      // Should have subsection headings
      expect(screen.getByRole('heading', { name: /^full access to core features$/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /^beta[- ]?only perks$/i })).toBeInTheDocument();
    });
  });

  describe('Current Limitations Section', () => {
    it('includes transparent limitation messaging about coverage', () => {
      render(<BetaPage />);
      
      const limitationsSection = screen.getByTestId('limitations');
      
      // Transparency about current state
      expect(limitationsSection).toHaveTextContent('17%');
      expect(limitationsSection).toHaveTextContent('Growing question bank');
      expect(limitationsSection).toHaveTextContent('questions');
    });

    it('mentions mocked recommendations and missing analytics', () => {
      render(<BetaPage />);
      
      const limitationsSection = screen.getByTestId('limitations');
      
      expect(limitationsSection).toHaveTextContent('Learning study patterns');
      expect(limitationsSection).toHaveTextContent('Building analytics dashboard');
    });

    it('includes beta bugs disclaimer', () => {
      render(<BetaPage />);
      
      const limitationsSection = screen.getByTestId('limitations');
      
      expect(limitationsSection).toHaveTextContent('Possible bugs');
      expect(limitationsSection).toHaveTextContent('beta');
    });
  });

  describe('User Expectations Section', () => {
    it('lists specific user responsibilities with timeframes', () => {
      render(<BetaPage />);
      
      const expectationsSection = screen.getByTestId('expectations');
      
      // User responsibilities
      expect(expectationsSection).toHaveTextContent('Kick off your beta journey');
      expect(expectationsSection).toHaveTextContent('within');
      expect(expectationsSection).toHaveTextContent('week');
      expect(expectationsSection).toHaveTextContent('Share your experience');
      expect(expectationsSection).toHaveTextContent('Help us improve');
    });

    it('mentions optional user call participation', () => {
      render(<BetaPage />);
      
      const expectationsSection = screen.getByTestId('expectations');
      
      expect(expectationsSection).toHaveTextContent('Optional');
      expect(expectationsSection).toHaveTextContent('calls');
    });
  });

  describe('Target Audience Section', () => {
    it('describes ideal beta participants', () => {
      render(<BetaPage />);
      
      const targetSection = screen.getByTestId('target-audience');
      
      // Target characteristics
      expect(targetSection).toHaveTextContent('PMLE exam preparation');
      expect(targetSection).toHaveTextContent('feedback');
      expect(targetSection).toHaveTextContent('Early adopters');
    });
  });

  describe('Privacy Section', () => {
    it('includes clear privacy commitments', () => {
      render(<BetaPage />);
      
      const privacySection = screen.getByTestId('privacy');
      
      // Privacy commitments
      expect(privacySection).toHaveTextContent('Secure storage');
      expect(privacySection).toHaveTextContent('No third-party sharing');
      expect(privacySection).toHaveTextContent('without consent');
      expect(privacySection).toHaveTextContent('Deletion on request');
    });
  });

  describe('Getting Started Section', () => {
    it('provides numbered steps for onboarding', () => {
      render(<BetaPage />);
      
      const stepsSection = screen.getByTestId('getting-started');
      
      // Sequential steps
      expect(stepsSection).toHaveTextContent('1');
      expect(stepsSection).toHaveTextContent('2');
      expect(stepsSection).toHaveTextContent('3');
      expect(stepsSection).toHaveTextContent('4');
      
      // Key step content
      expect(stepsSection).toHaveTextContent('Click invite link');
      expect(stepsSection).toHaveTextContent('Sign in');
      expect(stepsSection).toHaveTextContent('create account');
      expect(stepsSection).toHaveTextContent('Start diagnostic');
      expect(stepsSection).toHaveTextContent('15');
      expect(stepsSection).toHaveTextContent('20');
      expect(stepsSection).toHaveTextContent('minutes');
      expect(stepsSection).toHaveTextContent('Review results');
    });
  });
});