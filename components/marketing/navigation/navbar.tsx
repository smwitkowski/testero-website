'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { colorPrimitive, typographyPrimitive } from '@/lib/design-system';
import { useAuth } from '@/components/providers/AuthProvider';

const navigationItems = [
  { name: 'Home', href: '/' },
  { name: 'Content Hub', href: '/content' },
  { name: 'Blog', href: '/blog' },
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
      className={`fixed top-0 left-0 right-0 z-50 h-[72px] bg-white bg-opacity-80 backdrop-blur-md ${
        isScrolled ? 'shadow-sm border-b border-ui-border-light' : ''
      }`}
      style={{ borderColor: colorPrimitive.slate[200] }}
    >
      <div className="container mx-auto px-4 h-full flex items-center justify-between md:justify-start">
        {/* Logo Placeholder */}
        <div className="flex-shrink-0 md:mr-6">
          {/* Replace with actual logo component */}
          <Link href="/" aria-label="Testero Home">
            <span className="text-xl font-bold" style={{ color: colorPrimitive.slate[800] }}>Testero</span> {/* Replace with actual logo */}
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <div className="md:hidden flex items-center ml-auto">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="text-ui-text-primary focus:outline-none focus:ring-2 focus:ring-accent-500"
            style={{ color: colorPrimitive.slate[800] }}
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
              className={`relative ${pathname === item.href ? 'text-accent-500' : 'text-primary-800'} hover:text-accent-500 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-500`}
              style={{ fontSize: typographyPrimitive.fontSize.base }}
              aria-current={pathname === item.href ? 'page' : undefined}
            >
              {item.name}
              {pathname === item.href && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-500 transform translate-y-3"
                  style={{ backgroundColor: colorPrimitive.orange[500] }}
                ></span>
              )}
            </Link>
          ))}
        </nav>

        {/* Action Elements (Desktop) */}
        <div className="hidden md:flex items-center space-x-4 flex-shrink-0 ml-auto">
          {session ? (
            <>
              <Link
                href="/dashboard"
                className="text-ui-text-primary hover:text-accent-500 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-500"
                style={{ color: colorPrimitive.slate[800], fontSize: typographyPrimitive.fontSize.base }}
              >
                Dashboard
              </Link>
              <Link
                href="/practice/question"
                className="text-ui-text-primary hover:text-accent-500 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-500"
                style={{ color: colorPrimitive.slate[800], fontSize: typographyPrimitive.fontSize.base }}
              >
                Practice
              </Link>
              <button
                onClick={signOut}
                className="text-ui-text-primary hover:text-accent-500 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-500"
                style={{ color: colorPrimitive.slate[800], fontSize: typographyPrimitive.fontSize.base }}
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/waitlist"
                className="px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-accent-500"
                style={{ backgroundColor: colorPrimitive.orange[500], color: colorPrimitive.white, fontSize: typographyPrimitive.fontSize.base }}
              >
                Join Waitlist
              </Link>
              <Link
                href="/login"
                className="text-ui-text-primary hover:text-accent-500 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-500"
                style={{ color: colorPrimitive.slate[800], fontSize: typographyPrimitive.fontSize.base }}
              >
                Login
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Mobile Menu (Collapsible) */}
      {isMobileMenuOpen && (
        <div id="mobile-menu" className="md:hidden fixed inset-0 top-[72px] bg-white shadow-md transition-transform transform ease-in-out duration-300 translate-x-0">
          <nav className="flex flex-col space-y-4 px-4 py-6" aria-label="Mobile navigation">
            {navigationItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`relative ${pathname === item.href ? 'text-accent-500' : 'text-primary-800'} hover:text-accent-500 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-500`}
                style={{ fontSize: typographyPrimitive.fontSize.base }}
                onClick={() => setIsMobileMenuOpen(false)} // Close menu on link click
                aria-current={pathname === item.href ? 'page' : undefined}
              >
                {item.name}
              </Link>
            ))}
            {/* Action elements (Mobile) */}
            <div className="flex flex-col space-y-4 mt-4 pt-4 border-t border-ui-border-light" style={{ borderColor: colorPrimitive.slate[200] }}>
              {session ? (
                <>
                  <Link 
                    href="/dashboard" 
                    className="text-ui-text-primary text-center hover:text-accent-500 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-500" 
                    style={{ color: colorPrimitive.slate[800], fontSize: typographyPrimitive.fontSize.base }} 
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Dashboard
                  </Link>
                  <Link 
                    href="/practice/question" 
                    className="text-ui-text-primary text-center hover:text-accent-500 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-500" 
                    style={{ color: colorPrimitive.slate[800], fontSize: typographyPrimitive.fontSize.base }} 
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Practice
                  </Link>
                  <button
                    onClick={() => {
                      signOut();
                      setIsMobileMenuOpen(false);
                    }}
                    className="text-ui-text-primary text-center hover:text-accent-500 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-500"
                    style={{ color: colorPrimitive.slate[800], fontSize: typographyPrimitive.fontSize.base }}
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <Link 
                    href="/waitlist" 
                    className="px-4 py-2 rounded text-center focus:outline-none focus:ring-2 focus:ring-accent-500" 
                    style={{ backgroundColor: colorPrimitive.orange[500], color: colorPrimitive.white, fontSize: typographyPrimitive.fontSize.base }} 
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Join Waitlist
                  </Link>
                  <Link 
                    href="/login" 
                    className="text-ui-text-primary text-center hover:text-accent-500 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-500" 
                    style={{ color: colorPrimitive.slate[800], fontSize: typographyPrimitive.fontSize.base }} 
                    onClick={() => setIsMobileMenuOpen(false)}
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
