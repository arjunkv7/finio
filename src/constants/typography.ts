import { TextStyle } from 'react-native';

// Font family names after @expo-google-fonts/inter is loaded via useFonts()
export const FONT = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

// Type scale from Stitch design system
// letterSpacing is converted from em to dp (em × fontSize)
export const Typography = {
  displayAmount: {
    fontFamily: FONT.bold,
    fontSize: 48,
    lineHeight: 56,
    letterSpacing: -1.92, // -0.04em × 48
  } satisfies TextStyle,

  headlineLg: {
    fontFamily: FONT.bold,
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -0.64,
  } satisfies TextStyle,

  headlineLgMobile: {
    fontFamily: FONT.bold,
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: -0.48,
  } satisfies TextStyle,

  headlineMd: {
    fontFamily: FONT.semiBold,
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: -0.2,
  } satisfies TextStyle,

  bodyLg: {
    fontFamily: FONT.regular,
    fontSize: 18,
    lineHeight: 28,
  } satisfies TextStyle,

  bodyMd: {
    fontFamily: FONT.regular,
    fontSize: 16,
    lineHeight: 24,
  } satisfies TextStyle,

  labelMd: {
    fontFamily: FONT.medium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
  } satisfies TextStyle,

  labelSm: {
    fontFamily: FONT.semiBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
  } satisfies TextStyle,
} as const;
