# Testero Waitlist Page Design System

This document provides an overview of the design system created for the Testero waitlist landing page.

## Table of Contents

1. [Overview](#overview)
2. [Color System](#color-system)
3. [Typography](#typography)
4. [Spacing](#spacing)
5. [Breakpoints & Responsive Design](#breakpoints--responsive-design)
6. [Animations](#animations)
7. [Components](#components)
8. [Usage Guidelines](#usage-guidelines)
9. [Development Access](#development-access)

## Overview

The Testero waitlist design system is built to create a professional, tech-forward landing page that establishes trust and drives waitlist signups. The system emphasizes:

- Clean, modern aesthetics with a focus on readability
- Consistent spacing and alignment for visual harmony
- Strategic use of color to guide users through the conversion funnel
- Responsive behavior across all device sizes
- Thoughtful animations that enhance rather than distract
- Accessibility considerations throughout

## Color System

### Primary Colors

The color palette is built around slate blues for the primary brand colors and orange accents for calls to action and emphasis.

- **Primary (Slate)**: A range of slate colors from light (#f8fafc) to dark (#0f172a) providing a professional, clean foundation
- **Accent (Orange)**: Orange hues from light (#fff7ed) to dark (#7c2d12) for CTAs, highlights, and interactive elements

### Color Usage

The design system defines specific usage patterns for colors:

- Text colors with appropriate contrast levels
- Button colors with proper states (hover, active, disabled)
- Form element colors with validation states
- Card and container colors with border and shadow definitions

## Typography

### Font Families

- **Sans-serif**: System fonts (UI-optimized stack) for all text
- **Monospace**: System monospace fonts for code or technical elements

### Type Scale

A comprehensive type scale from xs (12px) to 9xl (128px) with appropriate responsive adjustments.

### Text Styles

Defined text styles for:

- Headings (h1-h4)
- Body text (large, default, small, caption)
- UI elements (buttons, form fields, labels)

Each text style includes appropriate font size, weight, line height, and letter spacing with mobile adaptations.

## Spacing

A consistent spacing system using a 4px base unit (0.25rem) with a comprehensive scale from 1px to 384px (24rem).

### Spacing Usage

Defined spacing patterns for:

- Page sections
- Component padding and margins
- Stacked and inline element spacing
- Form element spacing

## Breakpoints & Responsive Design

### Breakpoint System

- **xs**: 320px (Small mobile)
- **sm**: 640px (Mobile)
- **md**: 768px (Tablet)
- **lg**: 1024px (Small desktop/laptop)
- **xl**: 1280px (Desktop)
- **2xl**: 1536px (Large desktop)

### Responsive Patterns

Guidelines for how layouts and components should adapt across breakpoints:

- Mobile-first single column layouts
- Tablet two-column layouts
- Desktop multi-column layouts
- Responsive component adaptations (cards, navigation, forms)

## Animations

### Animation Timing

- **Duration**: Fast (150ms), Default (300ms), Slow (500ms), Slower (700ms)
- **Easing**: Various easing functions including spring and bounce effects
- **Delays**: For staggered animations

### Animation Patterns

- Hover/focus effects
- Entry/exit animations
- Loading states
- Success/error feedback
- Staggered animations
- Reduced motion alternatives

## Components

### Button System

- **Variants**: Primary, Secondary, Outline, Text
- **Sizes**: Small, Medium, Large
- **States**: Default, Hover, Active, Focus, Disabled

### Card System

- **Variants**: Default, Elevated, Flat, Interactive
- **Usage**: Content containers, feature highlights, social proof elements

### Form Elements

- **Input fields**: Text, Email, Password, Textarea
- **Labels**: Default, Required
- **Helper text**: Default, Error
- **States**: Default, Focus, Disabled, Error, Success

### Other Components

- Icons
- Badges/Tags

## Usage Guidelines

### General Principles

1. **Consistency**: Use the defined tokens rather than arbitrary values
2. **Hierarchy**: Maintain clear visual hierarchy with appropriate spacing and type scale
3. **Accessibility**: Ensure proper contrast ratios and accommodate reduced motion preferences
4. **Responsiveness**: Test across all breakpoints
5. **Performance**: Optimize animations and transitions for smooth performance

### Implementation

- Import design system tokens from the appropriate modules
- Use the `cn()` utility for combining class names with Tailwind
- Follow the defined component variants and patterns
- Refer to this documentation when creating new UI elements

## Development Access

The design system demo page is available at `/design-system` in the development environment only. This page is restricted in production to keep internal development resources private.

### Accessing the Design System Demo

- Local development: The demo page is available at `http://localhost:3000/design-system` when running the development server.
- Production: The page is not accessible in production environments.

This restriction is implemented in `app/design-system/page.tsx` using environment detection. If you need to access the design system in other environments, consider:

1. Using Basic Memory documentation at `testero-design/testero-design-system-documentation`
2. Deploying a separate, password-protected instance of the design system
3. Adding authenticated access to the design system page

---

This design system should serve as the foundation for all further development on the Testero waitlist page, ensuring consistency and quality throughout the user experience.
