// The Botanical Atelier — San Lucas Cafe
// Palette of the Forest: deep shadows and filtered light.
// Legacy keys (bgPage, accent, etc.) are preserved and remapped to
// the new tokens so existing screens keep working during the rollout.

export const colors = {
  // ── Botanical Atelier tokens ──────────────────────────────
  primary: '#051a0f',
  onPrimary: '#ffffff',
  primaryContainer: '#1a2f23',
  onPrimaryContainer: '#b6edc2',

  secondary: '#376847',
  onSecondary: '#ffffff',
  secondaryContainer: '#b6edc2',
  onSecondaryContainer: '#3b6d4b',

  tertiary: '#5a7d4f',
  onTertiary: '#ffffff',
  tertiaryContainer: '#dceac9',
  onTertiaryContainer: '#1f3315',

  // Surface hierarchy — stacked paper, no lines
  surface: '#f9faf2',
  onSurface: '#1a1c18',
  onSurfaceVariant: '#424843',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f3f4ec',
  surfaceContainer: '#edefe7',
  surfaceContainerHigh: '#e8e9e1',
  surfaceContainerHighest: '#e2e3db',

  cream: '#f8f9f1',

  // Ghost outlines — never use 100% opacity
  outline: '#737973',
  outlineVariant: '#c2c8c2',

  // Error
  error: '#ba1a1a',
  onError: '#ffffff',
  errorContainer: '#ffdad6',
  onErrorContainer: '#93000a',

  // ── Legacy aliases (mapped to botanical tokens) ───────────
  bgPage: '#f9faf2',                // surface
  bgCard: '#f3f4ec',                // surfaceContainerLow
  bgNavbar: 'rgba(249,250,242,0.8)',// glass surface
  accent: '#051a0f',                // primary forest
  accentHover: '#1a2f23',           // primaryContainer
  accentLight: '#b6edc2',           // secondaryContainer
  success: '#376847',               // secondary
  successLight: '#b6edc2',          // secondaryContainer
  danger: '#ba1a1a',                // error
  dangerLight: '#ffdad6',           // errorContainer
  warning: '#5a7d4f',               // tertiary
  warningLight: '#dceac9',          // tertiaryContainer
  textPrimary: '#1a1c18',           // onSurface
  textSecondary: '#424843',         // onSurfaceVariant
  textMuted: '#737973',             // outline
  border: '#c2c8c2',                // outlineVariant
  shadow: 'rgba(26,28,24,0.06)',
  shadowMd: 'rgba(26,28,24,0.08)',
};

// Ambient shadow preset — soft, tinted with on-surface
export const ambientShadow = {
  shadowColor: '#1a1c18',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.06,
  shadowRadius: 32,
  elevation: 4,
};

export const floatingShadow = {
  shadowColor: '#1a1c18',
  shadowOffset: { width: 0, height: -8 },
  shadowOpacity: 0.06,
  shadowRadius: 32,
  elevation: 8,
};
