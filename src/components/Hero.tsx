import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const Hero: React.FC = () => {
  return (
    <section className="relative z-10 flex items-center justify-center min-h-screen w-full">
      <div className="container mx-auto px-4 py-24 text-center">
        <div className="max-w-3xl mx-auto">
          <p className="text-lg font-medium text-primary mb-4">
            AI-Powered Certification Prep
          </p>
          <h1 className="scroll-m-20 text-5xl font-extrabold tracking-tight lg:text-6xl mb-6">
            Ace Your Certification Exams with Testero
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Personalized practice tests, adaptive learning, and expert-curated
            content to help you succeed in your professional certifications.
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/sign-up" passHref>
              <Button size="lg">Start Free Trial</Button>
            </Link>
            <Button size="lg" variant="outline">
              Explore Certifications
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;