import type { Config } from "tailwindcss";
import {
  primitive as colorPrimitive,
  semantic as colorSemantic,
} from "./lib/design-system/tokens/colors";
import { primitive as spacingPrimitive } from "./lib/design-system/tokens/spacing";
import { primitive as typographyPrimitive } from "./lib/design-system/tokens/typography";
import {
  primitive as effectsPrimitive,
  keyframes as effectsKeyframes,
} from "./lib/design-system/tokens/effects";

const config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        sm: "1.5rem",
        lg: "2rem",
      },
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

        // Design system primitive tokens
        slate: colorPrimitive.slate,
        orange: colorPrimitive.orange,
        red: colorPrimitive.red,
        green: colorPrimitive.green,
        blue: colorPrimitive.blue,
        indigo: colorPrimitive.indigo,
        cyan: colorPrimitive.cyan,
        yellow: colorPrimitive.yellow,
        purple: colorPrimitive.purple,

        // Brand colors
        brand: {
          teal: {
            DEFAULT: "#1D9C91",
            light: "#2BB8AC",
            dark: "#167A71",
          },
          navy: {
            DEFAULT: "#0E1A33",
            light: "#1A2D4D",
            dark: "#070D1A",
          },
        },

        // Semantic neutral colors
        neutral: colorSemantic.neutral,

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

        surface: {
          DEFAULT: "var(--surface-default)",
          subtle: "var(--surface-subtle)",
          muted: "var(--surface-muted)",
          elevated: "var(--surface-elevated)",
          brand: "var(--surface-brand)",
        },
        divider: "var(--divider-color)",
      },

      // Spacing scale from design system
      spacing: {
        ...spacingPrimitive,
        'card-x-sm': 'var(--space-card-x-sm)',
        'card-y-sm': 'var(--space-card-y-sm)',
        'card-gap-sm': 'var(--gap-card-sm)',
        'card-x-md': 'var(--space-card-x-md)',
        'card-y-md': 'var(--space-card-y-md)',
        'card-gap-md': 'var(--gap-card-md)',
        'card-x-lg': 'var(--space-card-x-lg)',
        'card-y-lg': 'var(--space-card-y-lg)',
        'card-gap-lg': 'var(--gap-card-lg)',
        'card-x': 'var(--space-card-x)',
        'card-y': 'var(--space-card-y)',
        'card-gap': 'var(--gap-card)',
        'card-sm': 'var(--gap-card-sm)',
        'card-md': 'var(--gap-card-md)',
        'card-lg': 'var(--gap-card-lg)',
        section_sm: "var(--section-sm)",
        section_md: "var(--section-md)",
        section_lg: "var(--section-lg)",
        section_xl: "var(--section-xl)",
      },

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
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-hero": `linear-gradient(135deg, ${colorPrimitive.brand.teal.DEFAULT} 0%, ${colorPrimitive.brand.teal.light} 100%)`,
        "gradient-cta": `linear-gradient(45deg, ${colorPrimitive.brand.teal.DEFAULT} 0%, ${colorPrimitive.brand.teal.dark} 100%)`,
        "gradient-badge": `linear-gradient(90deg, ${colorPrimitive.brand.teal.DEFAULT} 0%, ${colorPrimitive.brand.teal.light} 100%)`,
      },

      // Semantic text colors
      textColor: {
        primary: colorSemantic.text.primary,
        secondary: colorSemantic.text.secondary,
        muted: colorSemantic.text.muted,
      },

      // Semantic background colors
      backgroundColor: {
        surface: colorSemantic.surface.default,
        "surface-elevated": colorSemantic.surface.elevated,
      },

      // Semantic border colors
      borderColor: {
        default: colorSemantic.border.default,
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
        marquee: {
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
        marquee: "marquee var(--duration) linear infinite",
        "marquee-vertical": "marquee-vertical var(--duration) linear infinite",

        // Design system animations
        shimmer: "shimmer 1.5s infinite",
        spotlight: "spotlight 4s ease-in-out infinite",
        float: "float 3s ease-in-out infinite",
        "glow-pulse": "glowPulse 2s ease-in-out infinite",
      },

      // Unified prose styling configuration
      typography: (theme: any) => ({
        DEFAULT: {
          css: {
            // Base typography
            maxWidth: 'none',
            lineHeight: '1.7',
            fontSize: '1.125rem',
            color: theme('colors.gray.700'),
            
            // Headings
            'h1, h2, h3, h4, h5, h6': {
              color: theme('colors.gray.900'),
              fontWeight: '700',
              lineHeight: '1.3',
              scrollMarginTop: '5rem',
            },
            h1: {
              fontSize: '2.5rem',
              marginTop: '0',
              marginBottom: '2rem',
              borderBottom: `3px solid ${theme('colors.brand.teal.DEFAULT')}`,
              paddingBottom: '0.75rem',
              '@screen md': {
                fontSize: '3rem',
              },
            },
            h2: {
              fontSize: '2rem',
              marginTop: '3rem',
              marginBottom: '1.5rem',
              borderBottom: `2px solid ${theme('colors.gray.200')}`,
              paddingBottom: '0.5rem',
              '@screen md': {
                fontSize: '2.25rem',
              },
            },
            h3: {
              fontSize: '1.5rem',
              marginTop: '2.5rem',
              marginBottom: '1rem',
              color: theme('colors.brand.teal.DEFAULT'),
              '@screen md': {
                fontSize: '1.75rem',
              },
            },
            h4: {
              fontSize: '1.25rem',
              marginTop: '2rem',
              marginBottom: '1rem',
              fontWeight: '600',
              color: theme('colors.gray.800'),
              '@screen md': {
                fontSize: '1.375rem',
              },
            },
            
            // Paragraphs
            p: {
              marginTop: '1.5rem',
              marginBottom: '1.5rem',
              lineHeight: '1.7',
            },
            
            // Links
            a: {
              color: theme('colors.brand.teal.DEFAULT'),
              textDecoration: 'none',
              borderBottom: `1px solid ${theme('colors.brand.teal.light')}`,
              transition: 'all 0.2s ease',
              '&:hover': {
                color: theme('colors.brand.teal.dark'),
                borderBottomColor: theme('colors.brand.teal.DEFAULT'),
                borderBottomWidth: '2px',
              },
            },
            
            // Strong text
            strong: {
              color: theme('colors.gray.900'),
              fontWeight: '700',
            },
            
            // Emphasis
            em: {
              fontStyle: 'italic',
              color: theme('colors.gray.600'),
            },
            
            // Lists
            'ul, ol': {
              marginTop: '1.5rem',
              marginBottom: '1.5rem',
              paddingLeft: '2rem',
            },
            ul: {
              listStyleType: 'disc',
            },
            ol: {
              listStyleType: 'decimal',
            },
            li: {
              marginTop: '0.75rem',
              marginBottom: '0.75rem',
              lineHeight: '1.6',
              '&::marker': {
                color: theme('colors.brand.teal.DEFAULT'),
                fontWeight: '600',
              },
            },
            'li > ul, li > ol': {
              marginTop: '0.5rem',
              marginBottom: '0.5rem',
              paddingLeft: '1.5rem',
            },
            
            // Blockquotes
            blockquote: {
              backgroundColor: `${theme('colors.brand.teal.DEFAULT')}10`,
              borderLeft: `4px solid ${theme('colors.brand.teal.DEFAULT')}`,
              borderRadius: theme('borderRadius.lg'),
              padding: '1.5rem',
              margin: '2rem 0',
              fontStyle: 'italic',
              boxShadow: theme('boxShadow.sm'),
              '& p': {
                marginTop: '0',
                marginBottom: '1rem',
                color: theme('colors.gray.700'),
                '&:last-child': {
                  marginBottom: '0',
                },
              },
              '& strong': {
                color: theme('colors.brand.teal.dark'),
              },
            },
            
            // Code
            code: {
              backgroundColor: theme('colors.gray.100'),
              color: theme('colors.pink.600'),
              padding: '0.25rem 0.5rem',
              borderRadius: theme('borderRadius.md'),
              fontSize: '0.875rem',
              fontWeight: '500',
              border: `1px solid ${theme('colors.gray.200')}`,
              fontFamily: theme('fontFamily.mono').join(', '),
            },
            
            // Code blocks
            pre: {
              backgroundColor: theme('colors.gray.900'),
              color: theme('colors.gray.100'),
              padding: '1.5rem',
              borderRadius: theme('borderRadius.lg'),
              overflowX: 'auto',
              margin: '2rem 0',
              boxShadow: theme('boxShadow.lg'),
              '& code': {
                backgroundColor: 'transparent',
                color: 'inherit',
                padding: '0',
                border: 'none',
                fontSize: '0.875rem',
                lineHeight: '1.6',
              },
            },
            
            // Tables
            table: {
              width: '100%',
              borderCollapse: 'separate',
              borderSpacing: '0',
              margin: '2rem 0',
              borderRadius: theme('borderRadius.lg'),
              overflow: 'hidden',
              boxShadow: theme('boxShadow.sm'),
              border: `1px solid ${theme('colors.gray.200')}`,
            },
            th: {
              backgroundColor: theme('colors.gray.50'),
              color: theme('colors.gray.900'),
              fontWeight: '600',
              padding: '1rem 1.5rem',
              textAlign: 'left',
              borderBottom: `2px solid ${theme('colors.brand.teal.DEFAULT')}`,
              fontSize: '0.875rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            },
            td: {
              padding: '1rem 1.5rem',
              borderBottom: `1px solid ${theme('colors.gray.100')}`,
              color: theme('colors.gray.700'),
            },
            'tr:nth-child(even)': {
              backgroundColor: theme('colors.gray.50'),
            },
            'tr:hover': {
              backgroundColor: `${theme('colors.brand.teal.DEFAULT')}10`,
            },
            
            // Images
            img: {
              maxWidth: '100%',
              height: 'auto',
              borderRadius: theme('borderRadius.lg'),
              margin: '2rem 0',
              boxShadow: theme('boxShadow.md'),
            },
            
            // Horizontal rules
            hr: {
              border: '0',
              height: '2px',
              background: `linear-gradient(90deg, transparent, ${theme('colors.gray.300')}, transparent)`,
              margin: '3rem 0',
            },
            
            // Responsive adjustments
            '@screen sm': {
              fontSize: '1rem',
            },
            '@screen md': {
              fontSize: '1.125rem',
              lineHeight: '1.75',
            },
          },
        },
        
        // Size variants
        sm: {
          css: {
            fontSize: '0.875rem',
            lineHeight: '1.6',
            p: {
              marginTop: '1rem',
              marginBottom: '1rem',
            },
            h1: {
              fontSize: '2rem',
            },
            h2: {
              fontSize: '1.5rem',
            },
            h3: {
              fontSize: '1.25rem',
            },
          },
        },
        lg: {
          css: {
            fontSize: '1.25rem',
            lineHeight: '1.8',
            p: {
              marginTop: '2rem',
              marginBottom: '2rem',
            },
            h1: {
              fontSize: '3rem',
            },
            h2: {
              fontSize: '2.5rem',
            },
            h3: {
              fontSize: '2rem',
            },
          },
        },
        xl: {
          css: {
            fontSize: '1.375rem',
            lineHeight: '1.8',
            p: {
              marginTop: '2rem',
              marginBottom: '2rem',
            },
            h1: {
              fontSize: '3.5rem',
            },
            h2: {
              fontSize: '2.75rem',
            },
            h3: {
              fontSize: '2.25rem',
            },
          },
        },
        
        // Color variants
        blue: {
          css: {
            '--tw-prose-links': theme('colors.brand.teal.DEFAULT'),
            '--tw-prose-invert-links': theme('colors.brand.teal.light'),
            a: {
              color: theme('colors.brand.teal.DEFAULT'),
              borderBottomColor: theme('colors.brand.teal.light'),
            },
            'a:hover': {
              color: theme('colors.brand.teal.dark'),
              borderBottomColor: theme('colors.brand.teal.DEFAULT'),
            },
            blockquote: {
              backgroundColor: `${theme('colors.brand.teal.DEFAULT')}10`,
              borderLeftColor: theme('colors.brand.teal.DEFAULT'),
            },
            'blockquote strong': {
              color: theme('colors.brand.teal.dark'),
            },
          },
        },
        
        // Dark mode variant
        invert: {
          css: {
            color: theme('colors.gray.300'),
            'h1, h2, h3, h4, h5, h6': {
              color: theme('colors.gray.100'),
            },
            h1: {
              borderBottomColor: theme('colors.brand.teal.light'),
            },
            h2: {
              borderBottomColor: theme('colors.gray.600'),
            },
            h3: {
              color: theme('colors.brand.teal.light'),
            },
            a: {
              color: theme('colors.brand.teal.light'),
              borderBottomColor: theme('colors.brand.teal.DEFAULT'),
            },
            'a:hover': {
              color: theme('colors.brand.teal.DEFAULT'),
              borderBottomColor: theme('colors.brand.teal.light'),
            },
            strong: {
              color: theme('colors.gray.100'),
            },
            blockquote: {
              backgroundColor: theme('colors.gray.800'),
              borderLeftColor: theme('colors.brand.teal.DEFAULT'),
              '& p': {
                color: theme('colors.gray.300'),
              },
              '& strong': {
                color: theme('colors.brand.teal.light'),
              },
            },
            code: {
              backgroundColor: theme('colors.gray.800'),
              color: theme('colors.pink.400'),
              borderColor: theme('colors.gray.700'),
            },
            pre: {
              backgroundColor: theme('colors.gray.900'),
            },
            table: {
              borderColor: theme('colors.gray.700'),
            },
            th: {
              backgroundColor: theme('colors.gray.800'),
              color: theme('colors.gray.100'),
              borderBottomColor: theme('colors.brand.teal.DEFAULT'),
            },
            td: {
              borderBottomColor: theme('colors.gray.700'),
              color: theme('colors.gray.300'),
            },
            'tr:nth-child(even)': {
              backgroundColor: theme('colors.gray.800'),
            },
            'tr:hover': {
              backgroundColor: theme('colors.gray.700'),
            },
          },
        },
      }),
    },
  },
  plugins: [
    require("tailwindcss-animate"), 
    require("@tailwindcss/typography"),
  ],
} satisfies Config;

export default config;
