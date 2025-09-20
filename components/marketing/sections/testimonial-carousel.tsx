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
            <figure className="w-full max-w-2xl mx-auto rounded-2xl bg-white p-6 sm:p-8 shadow-lg border border-slate-200 text-center">
              <blockquote className="text-lg sm:text-xl leading-relaxed italic text-slate-700 mb-6">
                &ldquo;{activeTestimonial.quote}&rdquo;
              </blockquote>
              <figcaption className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4 text-center sm:text-left">
                {activeTestimonial.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={activeTestimonial.avatar}
                    alt={activeTestimonial.author}
                    width={48}
                    height={48}
                    className="w-12 h-12 rounded-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center text-slate-700 font-medium">
                    {initials}
                  </div>
                )}
                <div className="text-center sm:text-left">
                  <p className="font-semibold text-slate-900">{activeTestimonial.author}</p>
                  <p className="text-sm text-slate-600">{activeTestimonial.role}</p>
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
                "w-3 h-3 rounded-full transition-all duration-300",
                index === currentIndex
                  ? "bg-orange-500 scale-125"
                  : "bg-slate-300 hover:bg-slate-400"
              )}
              aria-label={`Go to testimonial ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}