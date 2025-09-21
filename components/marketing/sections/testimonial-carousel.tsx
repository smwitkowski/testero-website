"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface Testimonial {
  id: string;
  quote: string;
  author: string;
  role: string;
  avatar?: string;
}

interface TestimonialCarouselProps {
  testimonials: Testimonial[];
  autoPlay?: boolean;
  autoPlayInterval?: number;
  className?: string;
}

export function TestimonialCarousel({
  testimonials,
  autoPlay = true,
  autoPlayInterval = 8000,
  className,
}: TestimonialCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!autoPlay || testimonials.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => 
        prevIndex === testimonials.length - 1 ? 0 : prevIndex + 1
      );
    }, autoPlayInterval);

    return () => clearInterval(interval);
  }, [autoPlay, autoPlayInterval, testimonials.length]);

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  if (!testimonials.length) return null;

  const activeTestimonial = testimonials[currentIndex];
  const initials = activeTestimonial.author
    .split(" ")
    .filter(Boolean)
    .map((name) => name[0])
    .join("");

  return (
    <div className={cn("relative max-w-4xl mx-auto", className)}>
      <div className="relative min-h-[18rem] sm:min-h-[20rem]">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="flex w-full items-center justify-center px-4"
          >
            <figure className="mx-auto w-full max-w-2xl rounded-2xl border border-[color:var(--divider-color)] bg-[color:var(--surface-elevated)] p-6 text-center shadow-lg sm:p-8">
              <blockquote className="mb-6 text-lg italic leading-relaxed text-muted-foreground sm:text-xl">
                &ldquo;{activeTestimonial.quote}&rdquo;
              </blockquote>
              <figcaption className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4 text-center sm:text-left">
                {activeTestimonial.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={activeTestimonial.avatar}
                    alt={activeTestimonial.author}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--surface-muted)] font-medium text-foreground">
                    {initials}
                  </div>
                )}
                <div className="text-center sm:text-left">
                  <p className="font-semibold text-foreground">{activeTestimonial.author}</p>
                  <p className="text-sm text-muted-foreground">{activeTestimonial.role}</p>
                </div>
              </figcaption>
            </figure>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation dots */}
      {testimonials.length > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {testimonials.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={cn(
                "h-3 w-3 rounded-full transition-all duration-300",
                index === currentIndex
                  ? "scale-125 bg-[color:var(--tone-accent)]"
                  : "bg-[color:var(--divider-color)] hover:bg-[color:var(--tone-accent-surface)]"
              )}
              aria-label={`Go to testimonial ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}