'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { colors } from '@/lib/design-system/colors';
import { typography } from '@/lib/design-system/typography';
import { useAuth } from '@/components/providers/AuthProvider';

const navigationItems = [
  { name: 'Home', href: '/' },
  { name: 'Content Hub', href: '/content' },
  { name: 'FAQ', href: '/faq' },
  // Design System link removed
  // Resources dropdown temporarily removed until pages are created
];

// Profile menu items for authenticated users
const profileMenuItems = [
  { name: 'Dashboard', href: '/practice/question' },
  { name: 'Profile', href: '/profile' },
  // Add more items as needed
];

const Navbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { user, signOut, isLoading } = useAuth();

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

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (isProfileMenuOpen && !target.closest('#profile-menu-container')) {
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileMenuOpen]);

  const handleLogout = async () => {
    await signOut();
    setIsProfileMenuOpen(false);
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 h-[72px] bg-white bg-opacity-80 backdrop-blur-md ${
        isScrolled ? 'shadow-sm border-b border-ui-border-light' : ''
      }`}
      style={{ borderColor: colors.ui.border.light }}
    >
      <div className="container mx-auto px-4 h-full flex items-center justify-between md:justify-start">
        {/* Logo Placeholder */}
        <div className="flex-shrink-0 md:mr-6">
          {/* Replace with actual logo component */}
          <Link href="/" aria-label="Testero Home">
            <span className="text-xl font-bold" style={{ color: colors.primary[800] }}>Testero</span> {/* Replace with actual logo */}
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <div className="md:hidden flex items-center ml-auto">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="text-ui-text-primary focus:outline-none focus:ring-2 focus:ring-accent-500"
            style={{ color: colors.primary[800] }}
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
              style={{ ...typography.button.default }}
              aria-current={pathname === item.href ? 'page' : undefined}
            >
              {item.name}
              {pathname === item.href && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-500 transform translate-y-3"
                  style={{ backgroundColor: colors.accent[500] }}
                ></span>
              )}
            </Link>
          ))}
        </nav>

        {/* Action Elements (Desktop) */}
        <div className="hidden md:flex items-center space-x-4 flex-shrink-0 ml-auto">
          {isLoading ? (
            // Loading state placeholder
            <div className="h-10 w-20 bg-gray-200 animate-pulse rounded"></div>
          ) : user ? (
            // Authenticated user - show profile menu
            <div id="profile-menu-container" className="relative">
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center space-x-2 focus:outline-none focus:ring-2 focus:ring-accent-500 rounded-full"
                aria-expanded={isProfileMenuOpen}
                aria-haspopup="true"
              >
                <div className="w-8 h-8 rounded-full bg-accent-500 flex items-center justify-center text-white">
                  {/* Use first letter of email as avatar placeholder */}
                  {user.email?.charAt(0).toUpperCase() || 'U'}
                </div>
              </button>
              
              {/* Profile dropdown menu */}
              {isProfileMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-ui-border-light"
                     style={{ borderColor: colors.ui.border.light }}
                     role="menu"
                     aria-orientation="vertical"
                     aria-labelledby="user-menu-button">
                  <div className="px-4 py-2 text-sm text-gray-500 border-b border-ui-border-light" style={{ borderColor: colors.ui.border.light }}>
                    {user.email}
                  </div>
                  {profileMenuItems.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      className="block px-4 py-2 text-sm text-primary-800 hover:bg-gray-100"
                      style={{ color: colors.primary[800] }}
                      onClick={() => setIsProfileMenuOpen(false)}
                      role="menuitem"
                    >
                      {item.name}
                    </Link>
                  ))}
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-gray-100"
                    role="menuitem"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            // Not authenticated - show login/signup buttons
            <>
              <Link
                href="/signup"
                className="px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-accent-500"
                style={{ backgroundColor: colors.accent[500], color: colors.ui.white, ...typography.button.default }}
              >
                Sign Up
              </Link>
              <Link
                href="/login"
                className="text-ui-text-primary hover:text-accent-500 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-500"
                style={{ color: colors.primary[800], ...typography.button.default }}
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
                style={{ ...typography.button.default }}
                onClick={() => setIsMobileMenuOpen(false)} // Close menu on link click
                aria-current={pathname === item.href ? 'page' : undefined}
              >
                {item.name}
              </Link>
            ))}
            
            {/* Auth-related actions for mobile */}
            <div className="flex flex-col space-y-4 mt-4 pt-4 border-t border-ui-border-light" style={{ borderColor: colors.ui.border.light }}>
              {isLoading ? (
                // Loading state placeholder
                <div className="h-10 bg-gray-200 animate-pulse rounded"></div>
              ) : user ? (
                // Authenticated user - show profile links
                <>
                  <div className="px-4 py-2 text-sm text-gray-500">
                    {user.email}
                  </div>
                  {profileMenuItems.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      className="text-primary-800 hover:text-accent-500 transition-colors duration-200"
                      style={{ color: colors.primary[800], ...typography.button.default }}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {item.name}
                    </Link>
                  ))}
                  <button
                    onClick={handleLogout}
                    className="text-left text-red-500 hover:text-red-700 transition-colors duration-200"
                    style={{ ...typography.button.default }}
                  >
                    Sign out
                  </button>
                </>
              ) : (
                // Not authenticated - show login/signup buttons
                <>
                  <Link href="/signup" className="px-4 py-2 rounded text-center focus:outline-none focus:ring-2 focus:ring-accent-500" style={{ backgroundColor: colors.accent[500], color: colors.ui.white, ...typography.button.default }} onClick={() => setIsMobileMenuOpen(false)}>
                    Sign Up
                  </Link>
                  <Link href="/login" className="text-ui-text-primary text-center hover:text-accent-500 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-500" style={{ color: colors.primary[800], ...typography.button.default }} onClick={() => setIsMobileMenuOpen(false)}>
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
