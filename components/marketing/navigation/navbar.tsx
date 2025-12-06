'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { TesteroLogo } from '@/components/brand';

const navigationItems = [
  { name: 'Home', href: '/' },
  { name: 'Content Hub', href: '/content' },
  { name: 'Blog', href: '/blog' },
  { name: 'Pricing', href: '/pricing' },
  { name: 'FAQ', href: '/faq' },
  // Design System link removed
  // Resources dropdown temporarily removed until pages are created
];

const Navbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  // const [isResourcesDropdownOpen, setIsResourcesDropdownOpen] = useState(false); // Removed
  const pathname = usePathname();
  const { session, signOut } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 0) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);

    // Clean up the event listener on component unmount
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Close mobile menu when screen size changes to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768 && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [isMobileMenuOpen]);


  // Removed unused click handler for dropdown toggle
  // const handleResourcesClick = () => {
  //   setIsResourcesDropdownOpen(!isResourcesDropdownOpen);
  // };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 h-[72px] bg-background md:bg-background/80 md:backdrop-blur-md transition-colors ${
        isScrolled ? 'shadow-sm border-b border-border/60' : 'border-b border-transparent'
      }`}
    >
      <div className="container mx-auto px-4 h-full flex items-center justify-between md:justify-start">
        {/* Logo */}
        <div className="flex-shrink-0 md:mr-6">
          <TesteroLogo size="md" href="/" />
        </div>

        {/* Mobile Menu Button */}
        <div className="md:hidden flex items-center ml-auto">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="Toggle mobile menu"
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-menu"
          >
            {/* Hamburger Icon */}
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7"></path></svg>
          </button>
        </div>

        {/* Navigation Links (Desktop) */}
        <nav className="hidden md:flex space-x-6 flex-grow justify-center" aria-label="Primary navigation">
          {navigationItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={`relative text-sm font-medium transition-colors duration-200 ${
                pathname === item.href ? 'text-foreground' : 'text-muted-foreground'
              } hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background`}
              aria-current={pathname === item.href ? 'page' : undefined}
            >
              {item.name}
              {pathname === item.href && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent transform translate-y-3"
                ></span>
              )}
            </Link>
          ))}
        </nav>

        {/* Action Elements (Desktop) */}
        <div className="hidden md:flex items-center space-x-4 flex-shrink-0 ml-auto">
          <ThemeToggle />
          {session ? (
            <>
              <Link
                href="/dashboard"
                className="text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Dashboard
              </Link>
              <Link
                href="/practice/question"
                className="text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Practice
              </Link>
              <button
                onClick={signOut}
                className="text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/signup"
                className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label="Get started with Testero - Sign up for an account"
              >
                Get Started
              </Link>
              <Link
                href="/login"
                className="text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label="Login to your Testero account"
              >
                Login
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Mobile Menu (Collapsible) */}
      {isMobileMenuOpen && (
        <div id="mobile-menu" className="md:hidden fixed inset-0 top-[72px] bg-background text-foreground shadow-md transition-transform transform ease-in-out duration-300 translate-x-0">
          <nav className="flex flex-col space-y-4 px-4 py-6" aria-label="Mobile navigation">
            {navigationItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`relative text-base font-medium transition-colors duration-200 ${
                  pathname === item.href ? 'text-foreground' : 'text-muted-foreground'
                } hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background`}
                onClick={() => setIsMobileMenuOpen(false)} // Close menu on link click
                aria-current={pathname === item.href ? 'page' : undefined}
              >
                {item.name}
              </Link>
            ))}
            {/* Action elements (Mobile) */}
            <div className="flex flex-col space-y-4 mt-4 pt-4 border-t border-border/60">
              <ThemeToggle />
              {session ? (
                <>
                  <Link
                    href="/dashboard"
                    className="text-base font-medium text-center text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/practice/question"
                    className="text-base font-medium text-center text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Practice
                  </Link>
                  <button
                    onClick={() => {
                      signOut();
                      setIsMobileMenuOpen(false);
                    }}
                    className="text-base font-medium text-center text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/signup"
                    className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-base font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    onClick={() => setIsMobileMenuOpen(false)}
                    aria-label="Get started with Testero - Sign up for an account"
                  >
                    Get Started
                  </Link>
                  <Link
                    href="/login"
                    className="text-base font-medium text-center text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    onClick={() => setIsMobileMenuOpen(false)}
                    aria-label="Login to your Testero account"
                  >
                    Login
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Navbar;
