"use client";

import React from 'react';
import { motion } from "framer-motion";

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  footerText?: string;
  footerLink?: {
    href: string;
    text: string;
  };
}

export function AuthLayout({ children, title, subtitle, footerText, footerLink }: AuthLayoutProps) {
  return (
    <div className="min-h-screen pt-24 pb-12 md:pt-32 flex flex-col items-center justify-start bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="w-full max-w-md px-6">
        {/* Card Container */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white shadow-lg rounded-xl border border-slate-200 overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 py-8 text-center border-b border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-2">{title}</h1>
            <p className="text-slate-600">{subtitle}</p>
          </div>

          {/* Form Container */}
          <div className="px-6 py-8">
            {children}
          </div>
        </motion.div>

        {/* Footer Link */}
        {footerText && footerLink && (
          <div className="mt-8 text-center">
            <p className="text-slate-600">
              {footerText}{' '}
              <a 
                href={footerLink.href} 
                className="text-orange-500 hover:text-orange-600 transition-colors font-medium"
              >
                {footerLink.text}
              </a>
            </p>
          </div>
        )}

        {/* Visual Decoration */}
        <div className="absolute inset-0 opacity-10 pointer-events-none" aria-hidden="true">
          <div className="absolute top-0 left-1/4 w-64 h-64 rounded-full bg-blue-500 mix-blend-multiply blur-3xl"></div>
          <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full bg-orange-500 mix-blend-multiply blur-3xl"></div>
        </div>
      </div>
    </div>
  );
}