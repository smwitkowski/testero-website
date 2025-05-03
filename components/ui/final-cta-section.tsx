"use client";

import React from "react";
import { WaitlistForm } from "@/components/ui/waitlist-form";
import { motion } from "framer-motion";

export function FinalCtaSection() {
  return (
    <section className="w-full bg-gradient-to-br from-orange-50 via-orange-100 to-orange-50 py-10 sm:py-16 md:py-24 px-4 sm:px-6 text-center relative overflow-hidden">
      {/* Enhanced Background Elements */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute top-0 right-0 opacity-20 transform translate-x-1/4 -translate-y-1/4">
          <svg width="400" height="400" viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="200" cy="200" r="180" stroke="#ED8936" strokeWidth="2" strokeDasharray="8 8"/>
            <circle cx="200" cy="200" r="120" stroke="#ED8936" strokeWidth="2" strokeDasharray="6 6"/>
            <circle cx="200" cy="200" r="60" stroke="#ED8936" strokeWidth="2" strokeDasharray="4 4"/>
          </svg>
        </div>
        <div className="absolute bottom-0 left-0 opacity-20 transform -translate-x-1/4 translate-y-1/4">
          <svg width="320" height="320" viewBox="0 0 320 320" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="40" y="40" width="240" height="240" stroke="#ED8936" strokeWidth="2" strokeDasharray="6 6"/>
            <rect x="80" y="80" width="160" height="160" stroke="#ED8936" strokeWidth="2" strokeDasharray="4 4"/>
          </svg>
        </div>
        {/* Subtle diagonal lines */}
        <div className="absolute inset-0 opacity-10" style={{ 
          backgroundImage: "repeating-linear-gradient(45deg, #ED8936, #ED8936 1px, transparent 1px, transparent 20px)" 
        }}></div>
      </div>
      
      <div className="max-w-4xl mx-auto space-y-8 relative z-10">
        {/* Attention grabber with pulse animation */}
        <motion.div 
          className="mb-8 inline-block"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <span className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-5 py-2.5 rounded-full text-sm font-medium shadow-md">
            <span className="mr-2" aria-hidden="true">🔥</span>
            Limited Time Cloud Certification Offer
            <span className="ml-2" aria-hidden="true">🔥</span>
          </span>
        </motion.div>
        
        {/* Headline with more emphasis */}
        <h2 
          id="final-cta-heading"
          className="text-2xl sm:text-3xl md:text-5xl font-bold leading-tight text-slate-800 drop-shadow-sm"
        >
          Unlock Your <span className="text-orange-500">Fastest Path</span> to Google Cloud, AWS, and Azure Certification
          <br />
          Join the Waitlist Now
        </h2>
        
        {/* Value proposition with enhanced highlight */}
        <p className="text-base sm:text-lg md:text-xl text-slate-700 max-w-2xl mx-auto leading-relaxed">
          Be first to access Testero&apos;s AI-powered cloud certification platform and transform your study routine. Limited spots for Google Cloud, AWS, and Azure certification preparation. Secure your advantage today.
        </p>
        
        {/* Feature bullets with icons */}
        <ul className="flex flex-col md:flex-row gap-4 justify-center text-left max-w-2xl mx-auto" role="list">
          <li className="bg-white bg-opacity-70 backdrop-blur-sm p-4 rounded-lg border border-orange-200 flex items-start gap-3 flex-1">
            <div className="bg-orange-100 p-2 rounded-full text-orange-600" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Priority Cloud Certification Access</h3>
              <p className="text-sm text-slate-600">Be among the first to use Testero for your cloud certifications in July 2025.</p>
            </div>
          </li>
          
          <li className="bg-white bg-opacity-70 backdrop-blur-sm p-4 rounded-lg border border-orange-200 flex items-start gap-3 flex-1">
            <div className="bg-orange-100 p-2 rounded-full text-orange-600" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0c1.1.128 1.907 1.077 1.907 2.185Z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">30% Lifetime Certification Discount</h3>
              <p className="text-sm text-slate-600">Lock in your permanent Pro plan discount for all cloud certification prep.</p>
            </div>
          </li>
        </ul>
          
          {/* Enhanced Form Container with floating label effect */}
          <div className="pt-6 mx-auto max-w-md">
            <motion.div 
              className="bg-white p-4 sm:p-6 md:p-8 rounded-xl shadow-xl border border-orange-200"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-slate-800" id="waitlist-form-heading">Join the Cloud Certification Waitlist</h3>
                <div className="bg-orange-100 text-orange-700 text-sm font-medium px-3 py-1 rounded-full flex items-center">
                  <span className="inline-block w-2 h-2 bg-orange-500 rounded-full mr-2 animate-pulse" aria-hidden="true"></span>
                  <span aria-live="polite">300 spots left</span>
                </div>
              </div>
            
            <WaitlistForm 
              includeExamDropdown={true} 
              buttonText="Claim My Cloud Certification Discount" 
              className="space-y-5"
              ctaLocation="final_cta_section"
              aria-labelledby="waitlist-form-heading"
            />
            
            {/* Trust indicators */}
            <ul className="flex flex-col gap-2 mt-4" aria-label="Trust guarantees">
              <li className="flex items-center text-xs text-slate-500">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1 text-green-500" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                100% privacy. Your certification prep info stays safe, always.
              </li>
              <li className="flex items-center text-xs text-slate-500">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1 text-green-500" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                No risk. Cancel your cloud certification prep anytime, no obligation.
              </li>
            </ul>
          </motion.div>
        </div>
        
        {/* Countdown and social proof */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-6 text-sm text-slate-600">
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1 text-orange-500" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            Cloud certification early access begins July 2025
          </div>
          <div className="h-1 w-1 bg-slate-300 rounded-full hidden md:block" aria-hidden="true"></div>
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1 text-orange-500" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
            Join 1,200+ cloud certification professionals already on the waitlist
          </div>
        </div>
      </div>
    </section>
  );
}
