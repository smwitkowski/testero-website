"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface HoverButtonProps extends React.ComponentProps<"button"> {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  asChild?: boolean;
}

export const HoverButton: React.FC<HoverButtonProps> = ({ 
  children, 
  className, 
  ...props 
}) => {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      transition={{ type: "spring", stiffness: 400, damping: 10 }}
    >
      <Button className={className} {...props}>
        {children}
      </Button>
    </motion.div>
  );
}; 