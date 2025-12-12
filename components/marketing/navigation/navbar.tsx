'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { TesteroLogo } from '@/components/brand';
import { Menu } from 'lucide-react';

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


  // Prevent background scroll when the menu is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;

    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isMobileMenuOpen]);

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const getMobileNavLinkClasses = (isActive: boolean) =>
    [
      'flex items-center rounded-lg px-3 py-2 text-base transition-colors duration-200 min-h-[44px]',
      isActive ? 'text-foreground font-semibold bg-muted/40' : 'text-muted-foreground font-medium',
      'hover:text-foreground hover:bg-muted/30 active:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    ].join(' ');

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
            <Menu className="w-6 h-6" />
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
                aria-label="Start preparing with Testero - Sign up for an account"
              >
                Start Preparing
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
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] md:hidden"
            aria-hidden="true"
            onClick={closeMobileMenu}
          />
          <div
            id="mobile-menu"
            className="md:hidden fixed inset-x-0 top-[72px] bottom-0 z-50 bg-background text-foreground border-t border-border/60 shadow-xl transition-transform duration-300"
          >
            <nav className="flex h-full flex-col justify-between" aria-label="Mobile navigation">
              <div className="flex-1 overflow-y-auto py-6 space-y-8">
                <section className="space-y-5 px-6" aria-labelledby="mobile-primary-nav-label">
                  <p id="mobile-primary-nav-label" className="sr-only">
                    Primary navigation
                  </p>
                  {navigationItems.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={getMobileNavLinkClasses(pathname === item.href)}
                      onClick={closeMobileMenu}
                      aria-current={pathname === item.href ? 'page' : undefined}
                    >
                      {item.name}
                    </Link>
                  ))}
                </section>

                {session && (
                  <section
                    className="space-y-5 border-t border-border/60 pt-6 px-6"
                    aria-labelledby="mobile-account-nav-label"
                  >
                    <p id="mobile-account-nav-label" className="sr-only">
                      Account navigation
                    </p>
                    <Link
                      href="/dashboard"
                      className={getMobileNavLinkClasses(pathname === '/dashboard')}
                      onClick={closeMobileMenu}
                    >
                      Dashboard
                    </Link>
                    <Link
                      href="/practice/question"
                      className={getMobileNavLinkClasses(pathname.startsWith('/practice'))}
                      onClick={closeMobileMenu}
                    >
                      Practice
                    </Link>
                    <button
                      onClick={() => {
                        signOut();
                        closeMobileMenu();
                      }}
                      className={getMobileNavLinkClasses(false)}
                    >
                      Sign Out
                    </button>
                  </section>
                )}

                {!session && (
                  <section className="space-y-4 border-t border-border/60 pt-6 px-6">
                    <Link
                      href="/signup"
                      className="inline-flex w-full items-center justify-center rounded-full bg-primary px-4 py-3 text-base font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      onClick={closeMobileMenu}
                      aria-label="Get started with Testero - Sign up for an account"
                    >
                      Get Started
                    </Link>
                    <Link
                      href="/login"
                      className={getMobileNavLinkClasses(pathname === '/login')}
                      onClick={closeMobileMenu}
                      aria-label="Login to your Testero account"
                    >
                      Login
                    </Link>
                  </section>
                )}

                <section
                  className="border-t border-border/60 pt-6 px-6"
                  aria-labelledby="mobile-appearance-label"
                >
                  <p id="mobile-appearance-label" className="sr-only">
                    Appearance
                  </p>
                  <div className="flex items-center justify-between rounded-lg px-3 py-3 hover:bg-muted/30 transition-colors duration-200">
                    <div>
                      <p className="text-sm font-medium text-foreground">Appearance</p>
                      <p className="text-xs text-muted-foreground">Light / Dark</p>
                    </div>
                    <ThemeToggle />
                  </div>
                </section>
              </div>

              <div className="border-t border-border/60 px-6 py-5 text-sm text-muted-foreground">
                testero.ai
              </div>
            </nav>
          </div>
        </>
      )}
    </header>
  );
};

export default Navbar;
