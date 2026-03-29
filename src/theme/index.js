// ── Solvaa App Theme ─────────────────────────────────────────────────────────
// Clean, card-based. Font: Poppins.
// Blue palette with depth — multiple shades for visual richness.

export const colors = {
  bg:           '#f0f2f5',   // cool light gray background
  bgDeep:       '#e4e7ed',   // sunken areas
  white:        '#ffffff',
  border:       '#dde1e8',   // subtle border
  borderLight:  '#ebeef2',   // faint divider
  text:         '#1a1d26',   // primary text
  textMid:      '#4a4f5e',   // secondary text
  textMuted:    '#8a8f9e',   // labels / captions
  textFaint:    '#bcc1cc',   // placeholders
  // Primary action colour — rich blue
  primary:      '#4A6CF7',
  primaryLight: '#EEF1FE',
  primaryDark:  '#3A56D4',
  // Extended blue palette for depth
  blue50:       '#f0f3ff',
  blue100:      '#dde4fe',
  blue200:      '#b8c7fd',
  blue300:      '#8aa4fb',
  blue400:      '#6585f9',
  blue500:      '#4A6CF7',
  blue600:      '#3A56D4',
  blue700:      '#2C42A8',
  blue800:      '#1E2F7C',
  blue900:      '#141F54',
  // Accent blue — lighter, for highlights
  accent:       '#60A5FA',
  accentLight:  '#EFF6FF',
  // Functional status — use sparingly
  good:         '#22C55E',
  goodLight:    '#f0fdf4',
  caution:      '#F59E0B',
  cautionLight: '#FFFBEB',
  cautionBorder:'#FDE68A',
  warn:         '#EF4444',
  warnLight:    '#FEF2F2',
  warnBorder:   '#FECACA',
  blue:         '#3B82F6',
  blueLight:    '#EFF6FF',
  camp:         '#92400E',
  campLight:    '#92400E18',
  sos:          '#DC2626',
  // Map palette
  mapWater:     '#bfdbfe',
  mapLand:      '#e2e8f0',
  mapLandShore: '#cbd5e1',
  mapLandBorder:'#94a3b8',
  mapGreen:     '#bbf7d0',
  mapDeepWater: '#93c5fd',
  mapRoute:     '#4A6CF7',
  mapRouteAlt:  '#94a3b8',
};

export const fontFamily = {
  light:    'Poppins_300Light',
  regular:  'Poppins_400Regular',
  medium:   'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
};

export const font = {
  // Weight strings for StyleSheet (Poppins loaded via expo-font)
  thin:    '300',
  regular: '400',
  medium:  '500',
  semibold:'600',
};

export const text = {
  heading:    { fontSize: 18, fontWeight: '600', color: colors.text, fontFamily: fontFamily.semibold },
  subheading: { fontSize: 15, fontWeight: '600', color: colors.text, fontFamily: fontFamily.semibold },
  body:       { fontSize: 15, fontWeight: '400', color: colors.text, fontFamily: fontFamily.regular },
  bodyLight:  { fontSize: 15, fontWeight: '300', color: colors.textMid, fontFamily: fontFamily.light },
  small:      { fontSize: 13, fontWeight: '300', color: colors.textMid, fontFamily: fontFamily.light },
  label:      { fontSize: 10, fontWeight: '500', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, fontFamily: fontFamily.medium },
  metric:     { fontSize: 26, fontWeight: '300', color: colors.text, fontFamily: fontFamily.light },
  metricMd:   { fontSize: 19, fontWeight: '500', color: colors.text, fontFamily: fontFamily.medium },
  caption:    { fontSize: 11, fontWeight: '300', color: colors.textMuted, fontFamily: fontFamily.light },
};

export const layout = {
  pagePad:    20,
  cardRadius: 18,
  cardShadow: {
    shadowColor: '#1a1d26',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
  card: (extra = {}) => ({
    backgroundColor: '#ffffff',
    borderRadius: 18,
    shadowColor: '#1a1d26',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
    ...extra,
  }),
};

// Shared handle for bottom sheets
export const sheetHandle = {
  width: 36, height: 4, borderRadius: 2,
  backgroundColor: '#c8cdd6',
  alignSelf: 'center',
  marginTop: 10, marginBottom: 8,
};
