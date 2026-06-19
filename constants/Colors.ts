// The Botanical Atelier — San Lucas Cafe Design System
// Palette of the Forest: deep shadows and filtered light

export const palette = {
  // Primary — deep forest greens
  primary: '#051a0f',
  onPrimary: '#ffffff',
  primaryContainer: '#1a2f23',
  onPrimaryContainer: '#b6edc2',

  // Secondary — moss & sage
  secondary: '#376847',
  onSecondary: '#ffffff',
  secondaryContainer: '#b6edc2',
  onSecondaryContainer: '#3b6d4b',

  // Tertiary — accent botanicals
  tertiary: '#5a7d4f',
  onTertiary: '#ffffff',
  tertiaryContainer: '#dceac9',
  onTertiaryContainer: '#1f3315',

  // Error
  error: '#ba1a1a',
  onError: '#ffffff',
  errorContainer: '#ffdad6',
  onErrorContainer: '#410002',

  // Surface hierarchy — stacked sheets of heavy-weight paper
  surface: '#f9faf2',
  onSurface: '#1a1c18',
  onSurfaceVariant: '#43483e',

  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f3f4ec',
  surfaceContainer: '#edeee6',
  surfaceContainerHigh: '#e7e8e0',
  surfaceContainerHighest: '#e2e3db',

  // Cream — the breathing room
  cream: '#f8f9f1',

  // Outlines — used at low opacity only (Ghost Border rule)
  outline: '#73796d',
  outlineVariant: '#c3c8bb',

  // Inverse surfaces (for snackbars, tooltips)
  inverseSurface: '#2f312c',
  inverseOnSurface: '#f1f1e9',
  inversePrimary: '#9bd1ab',

  // Shadow — tinted with on-surface for ambient light feel
  shadow: '#1a1c18',
  scrim: '#000000',
};

// Gradients — the "soul" of primary CTAs
export const gradients = {
  primary: ['#051a0f', '#1a2f23'] as const,
  secondary: ['#376847', '#5a7d4f'] as const,
  surface: ['#f9faf2', '#f3f4ec'] as const,
};

// Ghost Border opacities — never use 100% opaque borders
export const borderOpacity = {
  ghost: 0.15,
  ghostFocused: 0.6,
};

// Ambient shadow — soft, tinted, never harsh
export const shadow = {
  ambient: {
    shadowColor: palette.onSurface,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 32,
    elevation: 4,
  },
  floating: {
    shadowColor: palette.onSurface,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 40,
    elevation: 8,
  },
};

// Glassmorphism — for floating navigation and modal overlays
export const glass = {
  surface: 'rgba(249, 250, 242, 0.75)',
  surfaceDark: 'rgba(26, 28, 24, 0.7)',
  blur: 20,
};

const tintColorLight = palette.primary;
const tintColorDark = palette.cream;

export default {
  light: {
    text: palette.onSurface,
    background: palette.surface,
    tint: tintColorLight,
    tabIconDefault: palette.outline,
    tabIconSelected: tintColorLight,

    // Extended Botanical Atelier tokens
    primary: palette.primary,
    onPrimary: palette.onPrimary,
    primaryContainer: palette.primaryContainer,
    onPrimaryContainer: palette.onPrimaryContainer,

    secondary: palette.secondary,
    onSecondary: palette.onSecondary,
    secondaryContainer: palette.secondaryContainer,
    onSecondaryContainer: palette.onSecondaryContainer,

    tertiary: palette.tertiary,
    onTertiary: palette.onTertiary,
    tertiaryContainer: palette.tertiaryContainer,
    onTertiaryContainer: palette.onTertiaryContainer,

    error: palette.error,
    onError: palette.onError,
    errorContainer: palette.errorContainer,
    onErrorContainer: palette.onErrorContainer,

    surface: palette.surface,
    onSurface: palette.onSurface,
    onSurfaceVariant: palette.onSurfaceVariant,
    surfaceContainerLowest: palette.surfaceContainerLowest,
    surfaceContainerLow: palette.surfaceContainerLow,
    surfaceContainer: palette.surfaceContainer,
    surfaceContainerHigh: palette.surfaceContainerHigh,
    surfaceContainerHighest: palette.surfaceContainerHighest,

    cream: palette.cream,
    outline: palette.outline,
    outlineVariant: palette.outlineVariant,
    inverseSurface: palette.inverseSurface,
    inverseOnSurface: palette.inverseOnSurface,
    inversePrimary: palette.inversePrimary,
    shadow: palette.shadow,
    scrim: palette.scrim,
  },
  dark: {
    text: '#e2e3db',
    background: '#101411',
    tint: tintColorDark,
    tabIconDefault: '#73796d',
    tabIconSelected: tintColorDark,

    primary: '#9bd1ab',
    onPrimary: '#003920',
    primaryContainer: '#1a2f23',
    onPrimaryContainer: '#b6edc2',

    secondary: '#b6edc2',
    onSecondary: '#1f3a28',
    secondaryContainer: '#376847',
    onSecondaryContainer: '#dceac9',

    tertiary: '#bfd2ad',
    onTertiary: '#2a3a20',
    tertiaryContainer: '#3f5235',
    onTertiaryContainer: '#dceac9',

    error: '#ffb4ab',
    onError: '#690005',
    errorContainer: '#93000a',
    onErrorContainer: '#ffdad6',

    surface: '#101411',
    onSurface: '#e2e3db',
    onSurfaceVariant: '#c3c8bb',
    surfaceContainerLowest: '#0a0e0b',
    surfaceContainerLow: '#181c19',
    surfaceContainer: '#1c211d',
    surfaceContainerHigh: '#272b27',
    surfaceContainerHighest: '#323632',

    cream: '#e2e3db',
    outline: '#8d9387',
    outlineVariant: '#43483e',
    inverseSurface: '#e2e3db',
    inverseOnSurface: '#2f312c',
    inversePrimary: '#376847',
    shadow: '#000000',
    scrim: '#000000',
  },
};
