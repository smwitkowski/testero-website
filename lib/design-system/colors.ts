// Design System: Colors
// This file defines the color palette for the Testero waitlist page

export const colors = {
  // Main brand colors
  primary: {
    50: '#f8fafc',  // Very light slate
    100: '#f1f5f9', // Light slate
    200: '#e2e8f0', // Slate 200
    300: '#cbd5e1', // Slate 300
    400: '#94a3b8', // Slate 400
    500: '#64748b', // Slate 500
    600: '#475569', // Slate 600
    700: '#334155', // Slate 700
    800: '#1e293b', // Slate 800
    900: '#0f172a', // Slate 900
  },
  
  // Accent colors (orange shades)
  accent: {
    50: '#fff7ed',  // Orange 50
    100: '#ffedd5', // Orange 100
    200: '#fed7aa', // Orange 200
    300: '#fdba74', // Orange 300
    400: '#fb923c', // Orange 400
    500: '#f97316', // Orange 500 (primary accent)
    600: '#ea580c', // Orange 600
    700: '#c2410c', // Orange 700
    800: '#9a3412', // Orange 800
    900: '#7c2d12', // Orange 900
  },

  // Success, error, warning colors
  feedback: {
    success: {
      light: '#d1fae5', // Green 100
      base: '#10b981',  // Green 500
      dark: '#065f46',  // Green 800
    },
    error: {
      light: '#fee2e2', // Red 100
      base: '#ef4444',  // Red 500
      dark: '#991b1b',  // Red 800
    },
    warning: {
      light: '#fef3c7', // Yellow 100
      base: '#f59e0b',  // Yellow 500
      dark: '#92400e',  // Yellow 800
    },
    info: {
      light: '#dbeafe', // Blue 100
      base: '#3b82f6',  // Blue 500
      dark: '#1e40af',  // Blue 800
    }
  },

  // Common UI colors
  ui: {
    white: '#ffffff',
    black: '#000000',
    background: {
      light: '#f8fafc', // Slate 50
      dark: '#0f172a',  // Slate 900
    },
    card: {
      light: '#ffffff',
      dark: '#1e293b',  // Slate 800
    },
    border: {
      light: '#e2e8f0', // Slate 200
      dark: '#334155',  // Slate 700
    }
  }
};

// Color usage guidelines
export const colorUsage = {
  pageBackground: colors.ui.background.light,
  text: {
    primary: colors.primary[800],
    secondary: colors.primary[600],
    muted: colors.primary[400],
    accent: colors.accent[500],
    inverse: colors.ui.white,
  },
  button: {
    primary: {
      background: colors.accent[500],
      hover: colors.accent[600],
      text: colors.ui.white,
    },
    secondary: {
      background: colors.primary[100],
      hover: colors.primary[200],
      text: colors.primary[800],
    },
    outline: {
      border: colors.primary[300],
      hover: colors.primary[200],
      text: colors.primary[800],
    }
  },
  card: {
    background: colors.ui.card.light,
    border: colors.ui.border.light,
    shadow: 'rgba(0, 0, 0, 0.1)'
  },
  input: {
    background: colors.ui.white,
    border: colors.primary[300],
    borderFocus: colors.accent[500],
    placeholder: colors.primary[400],
  }
};
