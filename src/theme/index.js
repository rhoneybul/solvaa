// ── Paddle App Theme ─────────────────────────────────────────────────────────
// Light, functional, map-focused. Single font: Inter.
// Colour only for meaning (good/caution/warn), never decoration.

export const colors = {
  bg:           '#f2f1ed',   // app background
  bgDeep:       '#e8e6e0',   // sunken areas
  white:        '#ffffff',
  border:       '#dad7d0',   // strong border
  borderLight:  '#eceae5',   // subtle divider
  text:         '#1a1a1a',   // primary text
  textMid:      '#5a5550',   // secondary text
  textMuted:    '#9a9590',   // labels / captions
  textFaint:    '#b8b4ae',   // placeholders
  // Functional status — use sparingly
  good:         '#3a6a4a',
  goodLight:    '#edf3ee',
  caution:      '#8a6a2a',
  cautionLight: '#faf5eb',
  cautionBorder:'#e8ddb8',
  warn:         '#8a4a3a',
  warnLight:    '#faf0ee',
  warnBorder:   '#e8ccc0',
  blue:         '#4a6a8a',
  blueLight:    '#eef2f8',
  camp:         '#8a5a2a',
  campLight:    '#8a5a2a18',
  sos:          '#7a2020',
  // Map palette
  mapWater:     '#b5ccde',
  mapLand:      '#d5ccb4',
  mapLandShore: '#d2caaf',
  mapLandBorder:'#c2b895',
  mapGreen:     '#beca96',
  mapDeepWater: '#a8c4d8',
  mapRoute:     '#3a6a4a',
  mapRouteAlt:  '#8a8a7a',
};

export const font = {
  // Inter weights only — never bold outside of headings
  thin:    '300',
  regular: '400',
  medium:  '500',
  semibold:'600',
};

export const text = {
  heading:    { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  subheading: { fontSize: 13, fontWeight: '600', color: '#1a1a1a' },
  body:       { fontSize: 13, fontWeight: '400', color: '#1a1a1a' },
  bodyLight:  { fontSize: 13, fontWeight: '300', color: '#5a5550' },
  small:      { fontSize: 11, fontWeight: '300', color: '#6a6560' },
  label:      { fontSize: 8,  fontWeight: '400', color: '#a09890', textTransform: 'uppercase', letterSpacing: 0.5 },
  metric:     { fontSize: 22, fontWeight: '300', color: '#1a1a1a' },
  metricMd:   { fontSize: 17, fontWeight: '500', color: '#1a1a1a' },
  caption:    { fontSize: 9.5,fontWeight: '300', color: '#9a9590' },
};

export const layout = {
  pagePad:    12,
  cardRadius: 9,
  cardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0.5 },
    shadowOpacity: 0.07,
    shadowRadius: 2,
    elevation: 1,
  },
  card: (extra = {}) => ({
    backgroundColor: '#ffffff',
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#eceae5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0.5 },
    shadowOpacity: 0.07,
    shadowRadius: 2,
    elevation: 1,
    ...extra,
  }),
};

// Shared handle for bottom sheets
export const sheetHandle = {
  width: 26, height: 3, borderRadius: 2,
  backgroundColor: '#c8c4bc',
  alignSelf: 'center',
  marginTop: 6, marginBottom: 4,
};
