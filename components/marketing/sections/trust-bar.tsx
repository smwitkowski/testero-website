"use client";

import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { cn } from "@/lib/utils";

interface TrustLogo {
  name: string;
  logo: React.ReactNode;
}

interface TrustBarProps {
  logos: TrustLogo[];
  title?: string;
  className?: string;
}

export function TrustBar({ logos, title = "Trusted by", className }: TrustBarProps) {
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  return (
    <section 
      ref={ref}
      className={cn(
        "w-full py-8 px-4 sm:px-6 bg-white/50 backdrop-blur-sm border-y border-slate-200/50",
        className
      )}
    >
      <div className="max-w-6xl mx-auto">
        {title && (
          <motion.h3 
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.6 }}
            className="text-sm uppercase tracking-wide text-slate-500 text-center mb-6"
          >
            {title}
          </motion.h3>
        )}
        
        <div className="flex flex-wrap justify-center items-center gap-8 sm:gap-12">
          {logos.map((logo, index) => (
            <motion.div
              key={logo.name}
              initial={{ opacity: 0.4, scale: 0.9 }}
              animate={inView ? { 
                opacity: [0.4, 1, 0.6], 
                scale: [0.9, 1.05, 1] 
              } : { opacity: 0.4, scale: 0.9 }}
              transition={{ 
                duration: 0.8,
                delay: index * 0.1,
                ease: "easeInOut"
              }}
              whileHover={{ 
                opacity: 1, 
                scale: 1.1,
                transition: { duration: 0.2 }
              }}
              className="flex items-center justify-center transition-all duration-300 grayscale hover:grayscale-0"
            >
              {logo.logo}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}