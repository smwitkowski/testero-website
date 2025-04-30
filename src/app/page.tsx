"use client";
import React from "react";
import { cn } from "@/lib/utils";
import AnimatedGridPattern from "@/components/magicui/animated-grid-pattern";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";

const CombinedLandingPage: React.FC = () => {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background">
      <AnimatedGridPattern
        numSquares={30}
        maxOpacity={0.1}
        duration={3}
        repeatDelay={1}
        className={cn(
          "absolute inset-0",
          "[mask-image:radial-gradient(circle_at_center,white_70%,transparent_80%)] skew-x-12"
        )}
      />

      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 0%, rgba(255,255,255,0.2) 30%, rgba(255,255,255,0.8) 60%, white 100%)",
        }}
      />

      <Navbar />
      <Hero />
    </div>
  );
};

export default CombinedLandingPage;
