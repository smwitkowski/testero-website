"use client";

import React from 'react';
import { motion } from "framer-motion";

interface AuthErrorAlertProps {
  error: string;
}

export function AuthErrorAlert({ error }: AuthErrorAlertProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-red-50 border border-red-200 rounded-md px-4 py-3 text-center"
      role="alert"
      aria-live="assertive"
    >
      <p className="text-red-600 font-medium flex items-center justify-center text-sm">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        {error}
      </p>
    </motion.div>
  );
}