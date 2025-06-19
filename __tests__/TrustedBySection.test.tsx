import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TrustedBySection, CompactTrustedBy, FastTrustedBy, LogoCard } from '@/components/sections/TrustedBySection';
import { partners } from '@/data/partners';

// Mock Next.js Image component
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, priority, loading, ...props }: any) => (
    <img src={src} alt={alt} {...props} />
  ),
}));

// Mock window.matchMedia for reduced motion tests
const mockMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
};

// Mock window.open
const mockWindowOpen = jest.fn();
Object.defineProperty(window, 'open', {
  writable: true,
  value: mockWindowOpen,
});

describe('TrustedBySection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMatchMedia(false); // Default: motion enabled
  });

  describe('Rendering', () => {
    it('renders with default props', () => {
      render(<TrustedBySection />);
      
      expect(screen.getByText('Trusted by industry leaders')).toBeInTheDocument();
      expect(screen.getByRole('region', { name: 'Our trusted partners' })).toBeInTheDocument();
    });

    it('renders with custom title and subtitle', () => {
      const customTitle = "Our Amazing Partners";
      const customSubtitle = "Working with the best in the industry";
      
      render(
        <TrustedBySection 
          title={customTitle}
          subtitle={customSubtitle}
        />
      );
      
      expect(screen.getByText(customTitle)).toBeInTheDocument();
      expect(screen.getByText(customSubtitle)).toBeInTheDocument();
    });

    it('renders partner logos', () => {
      const testPartners = partners.slice(0, 3);
      render(<TrustedBySection partners={testPartners} />);
      
      testPartners.forEach(partner => {
        expect(screen.getAllByAltText(partner.logoAlt)[0]).toBeInTheDocument();
      });
    });

    it('applies custom className', () => {
      const customClass = "custom-trusted-by";
      render(<TrustedBySection className={customClass} />);
      
      const section = screen.getByRole('region');
      expect(section).toHaveClass(customClass);
    });
  });

  describe('Variants', () => {
    it('renders compact variant correctly', () => {
      render(<CompactTrustedBy title="Compact Partners" />);
      
      expect(screen.getByText('Compact Partners')).toBeInTheDocument();
      // Compact variant should not show the CTA text
      expect(screen.queryByText('Join 100+ companies that trust our platform')).not.toBeInTheDocument();
    });

    it('renders fast variant correctly', () => {
      render(<FastTrustedBy title="Fast Partners" />);
      
      expect(screen.getByText('Fast Partners')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(<TrustedBySection />);
      
      expect(screen.getByRole('region', { name: 'Our trusted partners' })).toBeInTheDocument();
      expect(screen.getByLabelText('Partner logos carousel')).toBeInTheDocument();
    });

    it('renders static grid for reduced motion', () => {
      mockMatchMedia(true); // Reduced motion enabled
      
      render(<TrustedBySection />);
      
      // Should render grid instead of marquee
      const carousel = screen.getByLabelText('Partner logos carousel');
      expect(carousel.querySelector('.grid')).toBeInTheDocument();
    });

    it('supports keyboard navigation on logo cards', () => {
      const testPartner = partners[0];
      render(<LogoCard partner={testPartner} />);
      
      const logoCard = screen.getByRole('button', { name: `Visit ${testPartner.name} website` });
      
      // Should be focusable
      expect(logoCard).toHaveAttribute('tabIndex', '0');
      
      // Should respond to Enter key
      fireEvent.keyDown(logoCard, { key: 'Enter' });
      expect(mockWindowOpen).toHaveBeenCalledWith(testPartner.website, '_blank', 'noopener,noreferrer');
      
      // Should respond to Space key
      mockWindowOpen.mockClear();
      fireEvent.keyDown(logoCard, { key: ' ' });
      expect(mockWindowOpen).toHaveBeenCalledWith(testPartner.website, '_blank', 'noopener,noreferrer');
    });

    it('handles logo cards without websites gracefully', () => {
      const partnerWithoutWebsite = { ...partners[0], website: undefined };
      render(<LogoCard partner={partnerWithoutWebsite} />);
      
      const logoCard = screen.getByRole('button');
      fireEvent.click(logoCard);
      
      expect(mockWindowOpen).not.toHaveBeenCalled();
    });
  });

  describe('Interactions', () => {
    it('opens partner website when logo is clicked', () => {
      const testPartner = partners[0];
      render(<LogoCard partner={testPartner} />);
      
      const logoCard = screen.getByRole('button', { name: `Visit ${testPartner.name} website` });
      fireEvent.click(logoCard);
      
      expect(mockWindowOpen).toHaveBeenCalledWith(
        testPartner.website,
        '_blank',
        'noopener,noreferrer'
      );
    });

    it('applies hover effects correctly', () => {
      const testPartner = partners[0];
      render(<LogoCard partner={testPartner} />);
      
      const logoCard = screen.getByRole('button');
      
      // Check for hover classes
      expect(logoCard).toHaveClass('hover:scale-105');
      expect(logoCard).toHaveClass('transition-all');
    });
  });

  describe('Responsive Design', () => {
    it('applies responsive typography classes', () => {
      render(<TrustedBySection />);
      
      const title = screen.getByText('Trusted by industry leaders');
      expect(title).toHaveClass('text-2xl', 'sm:text-3xl', 'md:text-4xl');
    });

    it('applies responsive spacing classes', () => {
      render(<TrustedBySection />);
      
      const section = screen.getByRole('region');
      expect(section).toHaveClass('py-16', 'md:py-20');
    });
  });

  describe('Animation Configuration', () => {
    it('accepts different speed configurations', () => {
      const { rerender } = render(<TrustedBySection speed="fast" />);
      expect(screen.getByLabelText('Partner logos carousel')).toBeInTheDocument();
      
      rerender(<TrustedBySection speed="slow" />);
      expect(screen.getByLabelText('Partner logos carousel')).toBeInTheDocument();
      
      rerender(<TrustedBySection speed="normal" />);
      expect(screen.getByLabelText('Partner logos carousel')).toBeInTheDocument();
    });

    it('supports different directions', () => {
      const { rerender } = render(<TrustedBySection direction="left" />);
      expect(screen.getByLabelText('Partner logos carousel')).toBeInTheDocument();
      
      rerender(<TrustedBySection direction="right" />);
      expect(screen.getByLabelText('Partner logos carousel')).toBeInTheDocument();
    });

    it('can disable gradient mask', () => {
      render(<TrustedBySection showGradientMask={false} />);
      
      // Gradient masks should not be present
      const carousel = screen.getByLabelText('Partner logos carousel').parentElement;
      expect(carousel?.querySelector('.absolute')).not.toBeInTheDocument();
    });
  });

  describe('Design System Integration', () => {
    it('uses design system color classes', () => {
      render(<TrustedBySection />);
      
      const section = screen.getByRole('region');
      expect(section).toHaveClass('bg-white', 'dark:bg-slate-950');
    });

    it('uses design system typography classes', () => {
      render(<TrustedBySection />);
      
      const title = screen.getByText('Trusted by industry leaders');
      expect(title).toHaveClass('font-semibold');
    });

    it('applies design system spacing consistently', () => {
      render(<TrustedBySection />);
      
      const container = screen.getByRole('region').firstChild;
      expect(container).toHaveClass('max-w-7xl', 'mx-auto', 'px-4');
    });
  });
});

describe('Partner Data Structure', () => {
  it('has valid partner data structure', () => {
    expect(partners).toBeDefined();
    expect(Array.isArray(partners)).toBe(true);
    expect(partners.length).toBeGreaterThan(0);
    
    partners.forEach(partner => {
      expect(partner).toHaveProperty('id');
      expect(partner).toHaveProperty('name');
      expect(partner).toHaveProperty('logo');
      expect(partner).toHaveProperty('logoAlt');
      expect(typeof partner.id).toBe('string');
      expect(typeof partner.name).toBe('string');
      expect(typeof partner.logo).toBe('string');
      expect(typeof partner.logoAlt).toBe('string');
    });
  });
});