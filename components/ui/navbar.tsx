'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { colors } from '@/lib/design-system/colors';
import { typography } from '@/lib/design-system/typography';

const navigationItems = [
  { name: 'Home', href: '/' },
  { name: 'Content Hub', href: '/content' },
  { name: 'FAQ', href: '/faq' },
  { name: 'Design System', href: '/design-system' },
  {
    name: 'Resources',
    href: '#', // Or a placeholder if no main resources page
    dropdown: [
      { name: 'Google Cloud', href: '/resources/google-cloud' },
      { name: 'AWS', href: '/resources/aws' },
      { name: 'Azure', href: '/resources/azure' },
    ],
  },
];

const Navbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isResourcesDropdownOpen, setIsResourcesDropdownOpen] = useState(false);
  const pathname = usePathname();

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


  // Simplified click handler for dropdown toggle
  const handleResourcesClick = () => {
    setIsResourcesDropdownOpen(!isResourcesDropdownOpen);
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
            item.dropdown ? (
              <div
                key={item.name}
                className="relative"
                // Removed hover handlers
              >
                <button
                  className={`relative ${isResourcesDropdownOpen || (item.href !== '#' && pathname.startsWith(item.href)) ? 'text-accent-500' : 'text-primary-800'} hover:text-accent-500 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-500`}
                  style={{ ...typography.button.default }}
                  onClick={handleResourcesClick} // Use simple click to toggle
                  aria-expanded={isResourcesDropdownOpen}
                  aria-controls="resources-dropdown"
                >
                  {item.name}
                  {/* Dropdown Arrow */}
                  <svg className={`ml-1 inline-block w-4 h-4 transition-transform duration-200 ${isResourcesDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </button>
                {isResourcesDropdownOpen && (
                  <div
                    id="resources-dropdown"
                    className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 w-48 bg-white rounded-md shadow-lg py-1 ring-1 ring-black ring-opacity-5 focus:outline-none"
                    style={{ backgroundColor: colors.ui.white, borderColor: colors.ui.border.light }}
                    role="menu"
                    aria-orientation="vertical"
                    aria-labelledby="resources-menu"
                  >
                    {item.dropdown.map((dropdownItem) => (
                      <Link
                        key={dropdownItem.name}
                        href={dropdownItem.href}
                        className="block px-4 py-2 text-sm text-primary-800 hover:bg-primary-100 focus:outline-none focus:ring-2 focus:ring-accent-500"
                        style={{ color: colors.primary[800], ...typography.body.small }}
                        role="menuitem"
                        onClick={() => setIsResourcesDropdownOpen(false)}
                      >
                        {dropdownItem.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : (
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
            )
          ))}
        </nav>

        {/* Action Elements (Desktop) */}
        <div className="hidden md:flex items-center space-x-4 flex-shrink-0 ml-auto">
          <Link
            href="/waitlist"
            className="px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-accent-500"
            style={{ backgroundColor: colors.accent[500], color: colors.ui.white, ...typography.button.default }}
          >
            Join Waitlist
          </Link>
          <Link
            href="/login"
            className="text-ui-text-primary hover:text-accent-500 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-500"
            style={{ color: colors.primary[800], ...typography.button.default }}
          >
            Login
          </Link>
        </div>
      </div>

      {/* Mobile Menu (Collapsible) */}
      {isMobileMenuOpen && (
        <div id="mobile-menu" className="md:hidden fixed inset-0 top-[72px] bg-white shadow-md transition-transform transform ease-in-out duration-300 translate-x-0">
          <nav className="flex flex-col space-y-4 px-4 py-6" aria-label="Mobile navigation">
            {navigationItems.map((item) => (
              item.dropdown ? (
                <div key={item.name}>
                  <button
                    className={`w-full text-left relative ${isResourcesDropdownOpen || (item.href !== '#' && pathname.startsWith(item.href)) ? 'text-accent-500' : 'text-primary-800'} hover:text-accent-500 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-500`}
                    style={{ ...typography.button.default }}
                    onClick={handleResourcesClick}
                    aria-expanded={isResourcesDropdownOpen}
                    aria-controls="mobile-resources-dropdown"
                  >
                    {item.name}
                    {/* Dropdown Arrow */}
                    <svg className={`ml-1 inline-block w-4 h-4 transition-transform duration-200 ${isResourcesDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </button>
                  {isResourcesDropdownOpen && (
                    <div id="mobile-resources-dropdown" className="flex flex-col space-y-2 mt-2 pl-4">
                      {item.dropdown.map((dropdownItem) => (
                        <Link
                          key={dropdownItem.name}
                          href={dropdownItem.href}
                          className="block text-sm text-primary-800 hover:text-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500"
                          style={{ color: colors.primary[800], ...typography.body.small }}
                          onClick={() => {
                            setIsResourcesDropdownOpen(false);
                            setIsMobileMenuOpen(false);
                          }}
                        >
                          {dropdownItem.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
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
              )
            ))}
            {/* Action elements (Mobile) */}
            <div className="flex flex-col space-y-4 mt-4 pt-4 border-t border-ui-border-light" style={{ borderColor: colors.ui.border.light }}>
              <Link href="/waitlist" className="px-4 py-2 rounded text-center focus:outline-none focus:ring-2 focus:ring-accent-500" style={{ backgroundColor: colors.accent[500], color: colors.ui.white, ...typography.button.default }} onClick={() => setIsMobileMenuOpen(false)}>
                Join Waitlist
              </Link>
              <Link href="/login" className="text-ui-text-primary text-center hover:text-accent-500 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-500" style={{ color: colors.primary[800], ...typography.button.default }} onClick={() => setIsMobileMenuOpen(false)}>
                Login
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Navbar;
