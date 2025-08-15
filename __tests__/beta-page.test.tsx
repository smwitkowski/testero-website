import { render, screen } from '@testing-library/react';
import { describe, it, expect } from '@jest/globals';
import BetaPage from '@/app/beta/page';

describe('Beta Page Components', () => {
  it('renders hero section with correct headline', () => {
    render(<BetaPage />);
    
    const headline = screen.getByRole('heading', { 
      name: /welcome to the testero beta/i, 
      level: 1 
    });
    expect(headline).toBeInTheDocument();
    expect(headline).toHaveTextContent('Welcome to the Testero Beta - Here\'s What You Get');
  });

  it('displays beta benefits in organized sections', () => {
    render(<BetaPage />);
    
    const benefitsSection = screen.getByTestId('beta-benefits');
    expect(benefitsSection).toBeInTheDocument();
    
    // Should have a section heading
    const benefitsHeading = screen.getByRole('heading', { 
      name: /what you'll get/i 
    });
    expect(benefitsHeading).toBeInTheDocument();
  });

  it('shows current limitations with warning styling', () => {
    render(<BetaPage />);
    
    const limitationsSection = screen.getByTestId('limitations');
    expect(limitationsSection).toBeInTheDocument();
    expect(limitationsSection).toHaveClass('warning');
    
    // Should have appropriate heading
    const limitationsHeading = screen.getByRole('heading', { 
      name: /current limitations/i 
    });
    expect(limitationsHeading).toBeInTheDocument();
  });

  it('renders primary CTA button with correct styling', () => {
    render(<BetaPage />);
    
    const ctaButton = screen.getByTestId('cta-button');
    expect(ctaButton).toBeInTheDocument();
    expect(ctaButton).toHaveTextContent('Start Your Beta Now');
    expect(ctaButton).toHaveAttribute('type', 'button');
  });

  it('includes what we expect from you section', () => {
    render(<BetaPage />);
    
    const expectationsSection = screen.getByTestId('expectations');
    expect(expectationsSection).toBeInTheDocument();
    
    const expectationsHeading = screen.getByRole('heading', { 
      name: /what we expect from you/i 
    });
    expect(expectationsHeading).toBeInTheDocument();
  });

  it('shows who this beta is for section', () => {
    render(<BetaPage />);
    
    const targetSection = screen.getByTestId('target-audience');
    expect(targetSection).toBeInTheDocument();
    
    const targetHeading = screen.getByRole('heading', { 
      name: /who this beta is for/i 
    });
    expect(targetHeading).toBeInTheDocument();
  });

  it('includes data and privacy section', () => {
    render(<BetaPage />);
    
    const privacySection = screen.getByTestId('privacy');
    expect(privacySection).toBeInTheDocument();
    
    const privacyHeading = screen.getByRole('heading', { 
      name: /data.*privacy/i 
    });
    expect(privacyHeading).toBeInTheDocument();
  });

  it('shows how to get started section with steps', () => {
    render(<BetaPage />);
    
    const stepsSection = screen.getByTestId('getting-started');
    expect(stepsSection).toBeInTheDocument();
    
    const stepsHeading = screen.getByRole('heading', { 
      name: /how to get started/i 
    });
    expect(stepsHeading).toBeInTheDocument();
  });
});