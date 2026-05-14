// AG Trust Design Tokens — brand colors from AG Trust logo
export const Colors = {
  // Primary palette — AG Trust Navy Blue (from logo text & banner)
  navy: '#1E2D78',       // Deep navy blue (AG Trust brand)
  navyLight: '#2B3D9A',  // Lighter navy
  navyDark: '#141E55',   // Darkest navy
  navyGlass: 'rgba(30, 45, 120, 0.8)',

  // Accent colors — from logo figures
  green: '#4CAF1A',      // Bright green (left figure/leaf)
  greenLight: '#81C784',
  greenDark: '#3A8A12',  // Darker green
  red: '#E63012',        // Warm red (right figure/leaf)
  redLight: '#EF5350',
  redDark: '#C0250E',    // Darker red
  
  // Secondary / UI
  blue: '#3B82F6',
  blueLight: '#DBEAFE',
  amber: '#F59E0B',
  amberLight: '#FEF3C7',

  // Semantic
  success: '#4CAF1A',
  error: '#E63012',
  warning: '#F59E0B',
  info: '#3B82F6',

  // Backgrounds — clean white
  background: '#F8F9FF', // Soft blue-tinted white
  white: '#FFFFFF',
  cardBg: '#FFFFFF',
  surface: '#F4F6FF',
  surfaceHover: '#E8ECF8',

  // Borders
  border: '#E2E5F0',
  borderLight: '#EEF0F8',

  // Text
  foreground: '#1A1F3A', // Dark navy-tinted black
  muted: '#6B7280',
  mutedLight: '#9CA3AF',
  placeholder: '#A5B0C3',

  // Gradients
  gradients: {
    primary: ['#1E2D78', '#2B3D9A'],
    success: ['#4CAF1A', '#81C784'],
    danger: ['#E63012', '#EF5350'],
    surface: ['#FFFFFF', '#F8F9FF'],
  }
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
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
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
  sm: {
    shadowColor: '#1E2D78',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#1E2D78',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#1E2D78',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  premium: {
    shadowColor: '#1E2D78',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  button: {
    shadowColor: '#1E2D78',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  elevated: {
    shadowColor: '#1E2D78',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  }
};
