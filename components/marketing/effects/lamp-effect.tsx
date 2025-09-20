"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export const LampContainer = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <div
      className={cn(
        "relative w-full py-20 sm:py-24 md:py-32 overflow-hidden bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900",
        className
      )}
    >
      {/* Simplified spotlight effects */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Top spotlight */}
        <motion.div
          initial={{ opacity: 0.3, scale: 0.8 }}
          whileInView={{ opacity: 0.6, scale: 1 }}
          transition={{
            delay: 0.3,
            duration: 1.2,
            ease: "easeOut",
          }}
          className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[22rem] h-[22rem] rounded-full bg-gradient-radial from-orange-500/40 via-orange-500/20 to-transparent blur-2xl"
        />

        {/* Side accent lights */}
        <motion.div
          initial={{ opacity: 0.2, x: -100 }}
          whileInView={{ opacity: 0.4, x: 0 }}
          transition={{
            delay: 0.5,
            duration: 1.5,
            ease: "easeOut",
          }}
          className="absolute top-1/2 left-[12%] -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full bg-gradient-radial from-red-500/30 via-red-500/10 to-transparent blur-xl"
        />

        <motion.div
          initial={{ opacity: 0.2, x: 100 }}
          whileInView={{ opacity: 0.4, x: 0 }}
          transition={{
            delay: 0.7,
            duration: 1.5,
            ease: "easeOut",
          }}
          className="absolute top-1/2 right-[12%] translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full bg-gradient-radial from-orange-400/30 via-orange-400/10 to-transparent blur-xl"
        />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full">
        {children}
      </div>
    </div>
  );
};