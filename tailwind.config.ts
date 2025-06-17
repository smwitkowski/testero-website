import type { Config } from "tailwindcss"
import { primitive as colorPrimitive, semantic as colorSemantic } from './lib/design-system/tokens/colors'
import { primitive as spacingPrimitive } from './lib/design-system/tokens/spacing'
import { primitive as typographyPrimitive } from './lib/design-system/tokens/typography'
import { primitive as effectsPrimitive, keyframes as effectsKeyframes } from './lib/design-system/tokens/effects'

const config = {
  darkMode: "class",
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
	],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      // Design system integration
      colors: {
        // shadcn/ui compatibility (using CSS custom properties)
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        
        // Design system tokens
        slate: colorPrimitive.slate,
        orange: colorPrimitive.orange,
        red: colorPrimitive.red,
        green: colorPrimitive.green,
        blue: colorPrimitive.blue,
        indigo: colorPrimitive.indigo,
        
        // Semantic color aliases
        success: {
          light: colorSemantic.success.light,
          DEFAULT: colorSemantic.success.base,
          dark: colorSemantic.success.dark,
        },
        error: {
          light: colorSemantic.error.light,
          DEFAULT: colorSemantic.error.base,
          dark: colorSemantic.error.dark,
        },
        warning: {
          light: colorSemantic.warning.light,
          DEFAULT: colorSemantic.warning.base,
          dark: colorSemantic.warning.dark,
        },
        info: {
          light: colorSemantic.info.light,
          DEFAULT: colorSemantic.info.base,
          dark: colorSemantic.info.dark,
        },
      },
      
      // Spacing scale from design system
      spacing: spacingPrimitive,
      
      // Typography
      fontFamily: {
        sans: typographyPrimitive.fontFamily.sans,
        mono: typographyPrimitive.fontFamily.mono,
      },
      fontSize: typographyPrimitive.fontSize,
      fontWeight: typographyPrimitive.fontWeight,
      lineHeight: typographyPrimitive.lineHeight,
      letterSpacing: typographyPrimitive.letterSpacing,
      
      // Border radius from design system
      borderRadius: {
        ...effectsPrimitive.borderRadius,
        // shadcn/ui compatibility
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      
      // Box shadows
      boxShadow: effectsPrimitive.boxShadow,
      dropShadow: effectsPrimitive.dropShadow,
      
      // Backdrop blur
      backdropBlur: effectsPrimitive.blur,
      
      // Opacity scale
      opacity: effectsPrimitive.opacity,
      
      // Background images
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
      
      // Keyframes from design system and existing
      keyframes: {
        // shadcn/ui animations
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        
        // Existing marquee animations
        "marquee": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(calc(-100% - var(--gap)))" },
        },
        "marquee-vertical": {
          from: { transform: "translateY(0)" },
          to: { transform: "translateY(calc(-100% - var(--gap)))" },
        },
        
        // Design system keyframes
        ...effectsKeyframes,
      },
      
      // Animations
      animation: {
        // shadcn/ui animations
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        
        // Existing marquee animations
        "marquee": "marquee var(--duration) linear infinite",
        "marquee-vertical": "marquee-vertical var(--duration) linear infinite",
        
        // Design system animations
        "shimmer": "shimmer 1.5s infinite",
        "spotlight": "spotlight 4s ease-in-out infinite",
        "float": "float 3s ease-in-out infinite",
        "glow-pulse": "glowPulse 2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config

export default config
