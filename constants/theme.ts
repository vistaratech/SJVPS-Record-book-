// AG Trust Design Tokens — brand colors from AG Trust logo
export const Colors = {
  // Primary palette — AG Trust Navy Blue (from logo text & banner)
  navy: '#1E2D78',       // Deep navy blue (AG Trust brand)
  navyLight: '#2B3D9A',  // Lighter navy
  navyDark: '#141E55',   // Darkest navy

  // Accent colors — from logo figures
  green: '#4CAF1A',      // Bright green (left figure/leaf)
  greenDark: '#3A8A12',  // Darker green
  red: '#E63012',        // Warm red (right figure/leaf)
  redDark: '#C0250E',    // Darker red

  // Semantic
  destructive: '#E63012',
  destructiveBg: '#FEF2F2',
  warning: '#F59E0B',

  // Backgrounds — clean white
  background: '#F8F9FF', // Soft blue-tinted white
  white: '#FFFFFF',
  cardBg: '#FFFFFF',

  // Borders
  border: '#E2E5F0',
  borderLight: '#EEF0F8',

  // Text
  foreground: '#1A1F3A', // Dark navy-tinted black
  muted: '#6B7280',
  mutedLight: '#9CA3AF',
  placeholder: '#A5B0C3',

  // Sidebar / Surface
  surface: '#F4F6FF',
  surfaceHover: '#E8ECF8',
  sidebarBg: '#FFFFFF',

  // Charts (themed to AG Trust logo elements)
  chart1: '#1E2D78', // Navy Blue
  chart2: '#E63012', // Red
  chart3: '#4CAF1A', // Green
  chart4: '#5DB8F5', // Globe Light Blue
  chart5: '#2B3D9A', // Navy Light
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
};

export const BorderRadius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  full: 9999,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 30,
  title: 34,
};

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};

export const Shadows = {
  card: {
    shadowColor: '#1E2D78',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  elevated: {
    shadowColor: '#1E2D78',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 5,
  },
  button: {
    shadowColor: '#1E2D78',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
};
