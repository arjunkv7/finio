// Design system tokens extracted from Stitch / Figma style guide
export const DS_DARK = {
  surface: {
    base: '#0C0E12',      // surface-container-lowest — deepest bg
    screen: '#111317',    // background — screen fill
    card: '#1C1E23',      // Level 1 cards, 1px #FFFFFF10 border
    container: '#1E2024', // surface-container — inner sections
    elevated: '#282A2E',  // surface-container-high — raised elements
    highest: '#333539',   // surface-container-highest — dropdowns
  },

  // Brand / semantic
  primary: '#10B981',       // Emerald — income, CTA, active (primary-container)
  primaryLight: '#4EDEA3',  // lighter emerald — text on dark
  secondary: '#F43F5E',     // Rose — expense, destructive
  secondaryLight: '#FFB2B7',
  tertiary: '#F59E0B',      // Amber — savings, warnings, pending
  tertiaryLight: '#FFB95F',
  purple: '#9C7EF0',        // Investment purple

  text: {
    primary: '#E2E2E8',   // on-surface
    secondary: '#BBCABF', // on-surface-variant
    muted: '#86948A',     // outline
  },

  border: {
    subtle: 'rgba(255,255,255,0.063)', // 1px card edge (#FFFFFF10)
    medium: 'rgba(255,255,255,0.15)',  // secondary button stroke
    strong: '#3C4A42',                 // outline-variant
  },

  radius: {
    sm: 4,    // 0.25rem
    md: 12,   // 0.75rem — buttons, inputs
    lg: 16,   // 1rem
    xl: 24,   // 1.5rem — primary cards (always use for cards)
    full: 9999,
  },

  shadow: {
    card: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 4,
    },
    modal: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 20 },
      shadowOpacity: 0.4,
      shadowRadius: 40,
      elevation: 20,
    },
  },
} as const;

export const DS_LIGHT = {
  surface: {
    base: '#EDF0F4',
    screen: '#F5F7FA',
    card: '#FFFFFF',
    container: '#EDF0F4',
    elevated: '#E4E8EE',
    highest: '#D8DEE8',
  },

  primary: '#10B981',
  primaryLight: '#059669',  // darker emerald for text on light bg
  secondary: '#F43F5E',
  secondaryLight: '#E11D48',
  tertiary: '#F59E0B',
  tertiaryLight: '#D97706',
  purple: '#9C7EF0',

  text: {
    primary: '#111317',
    secondary: '#374151',
    muted: '#6B7482',
  },

  border: {
    subtle: 'rgba(0,0,0,0.06)',
    medium: 'rgba(0,0,0,0.15)',
    strong: '#CBD5E1',
  },

  radius: {
    sm: 4,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
  },

  shadow: {
    card: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    modal: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 20 },
      shadowOpacity: 0.15,
      shadowRadius: 40,
      elevation: 10,
    },
  },
} as const;

export type DSType = typeof DS_DARK;

// Default export kept for App.tsx splash screen (shown before theme loads)
export const DS = DS_DARK;

// Backward-compatible alias used by existing shell code
export const Colors = {
  background: {
    primary: DS_DARK.surface.screen,
    card: DS_DARK.surface.card,
    elevated: DS_DARK.surface.container,
  },
  accent: {
    green: DS_DARK.primary,
    red: DS_DARK.secondary,
    amber: DS_DARK.tertiary,
    purple: DS_DARK.purple,
  },
  text: {
    primary: DS_DARK.text.primary,
    secondary: DS_DARK.text.secondary,
    muted: DS_DARK.text.muted,
  },
} as const;
