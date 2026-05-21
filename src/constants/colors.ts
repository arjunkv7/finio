// Design system tokens extracted from Stitch / Figma style guide
export const DS = {
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

// Backward-compatible alias used by existing shell code
export const Colors = {
  background: {
    primary: DS.surface.screen,
    card: DS.surface.card,
    elevated: DS.surface.container,
  },
  accent: {
    green: DS.primary,
    red: DS.secondary,
    amber: DS.tertiary,
    purple: DS.purple,
  },
  text: {
    primary: DS.text.primary,
    secondary: DS.text.secondary,
    muted: DS.text.muted,
  },
} as const;
