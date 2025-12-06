"use client";

import React, { useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { AuthState } from "@/hooks";
import { TesteroIcon } from "@/components/brand";

export interface FooterLink {
  text: string;
  href: string;
  label: string;
}

export interface AuthFlowTemplateProps {
  /** The title to display at the top of the auth flow */
  title: string;
  /** Optional description text below the title */
  description?: string;
  /** Current state of the auth flow */
  currentState?: AuthState;
  /** Children components to render based on state */
  children: React.ReactNode;
  /** Whether to show the logo */
  showLogo?: boolean;
  /** Branding text to display */
  brandingText?: string;
  /** Footer links for navigation */
  footerLinks?: FooterLink[];
  /** Maximum width of the content container */
  maxWidth?: "sm" | "md" | "lg" | "xl";
  /** Theme mode */
  theme?: "light" | "dark";
  /** Additional CSS classes */
  className?: string;
  /** Callback when component mounts */
  onMount?: () => void;
}

const maxWidthClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
};

/**
 * Universal template component for authentication flows.
 * Provides consistent layout and structure for all auth pages.
 */
export const AuthFlowTemplate: React.FC<AuthFlowTemplateProps> = ({
  title,
  description,
  currentState = "form",
  children,
  showLogo = true,
  brandingText = "Testero - ML Engineering Excellence",
  footerLinks = [],
  maxWidth = "md",
  theme = "light",
  className = "",
  onMount,
}) => {
  useEffect(() => {
    if (onMount) {
      onMount();
    }
  }, [onMount]);

  return (
    <div
      className={`min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 ${
        theme === "dark" ? "dark bg-gray-900" : "bg-gray-50"
      } ${className}`}
    >
      <div className={`sm:mx-auto sm:w-full ${maxWidthClasses[maxWidth]}`}>
        {showLogo && (
          <div className="flex justify-center mb-6">
            <TesteroIcon size={48} />
          </div>
        )}

        {brandingText && (
          <h2 className="text-center text-sm text-gray-600 dark:text-gray-400 mb-8">
            {brandingText}
          </h2>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10"
        >
          <div className="space-y-6">
            {(currentState === "form" || !currentState) && (
              <>
                <div className="text-center">
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h3>
                  {description && (
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{description}</p>
                  )}
                </div>
                <div className="mt-6">{children}</div>
              </>
            )}

            {currentState === "loading" && <div className="py-8">{children}</div>}

            {currentState === "success" && <div className="py-8">{children}</div>}

            {currentState === "error" && <div className="py-8">{children}</div>}
          </div>
        </motion.div>

        {footerLinks.length > 0 && (
          <div className="mt-6 space-y-2">
            {footerLinks.map((link, index) => (
              <div key={index} className="text-center text-sm">
                <span className="text-gray-600 dark:text-gray-400">{link.text} </span>
                <Link
                  href={link.href}
                  className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  {link.label}
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

AuthFlowTemplate.displayName = "AuthFlowTemplate";
