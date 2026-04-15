// RecordBook Design Tokens — updated to match SJVPS school seal branding
export const Colors = {
  // Primary palette (mapped to Logo Deep Green despite 'navy' var name for compatibility)
  navy: '#14532D',      // Deep forest green (from hands/base)
  navyLight: '#166534', // Lighter forest green
  navyDark: '#064E3B',  // Darkest green

  // Accent colors
  green: '#EAB308',     // Mapped to bright signature Yellow from the logo center
  greenDark: '#CA8A04', // Darker yellow/gold
  destructive: '#DC2626', // Red (from typography "SJVPS - CBSE")
  destructiveBg: '#FEF2F2',
  warning: '#F59E0B',

  // Backgrounds
  background: '#FDFCF6', // Creamy off-white mimicking logo's outer border tone
  white: '#FFFFFF',
  cardBg: '#FFFFFF',

  // Borders
  border: '#EBEBDE',
  borderLight: '#F3F3E8',

  // Text
  foreground: '#1F2925', // Dark greenish black
  muted: '#6B726C',
  mutedLight: '#9CA39E',
  placeholder: '#A8B0AB',

  // Sidebar / Surface
  surface: '#F8F9F3',
  surfaceHover: '#EBEBDE',
  sidebarBg: '#FFFFFF',

  // Charts (themed to logo elements)
  chart1: '#14532D', // Deep Green
  chart2: '#DC2626', // Red Header
  chart3: '#EAB308', // Yellow Center
  chart4: '#06B6D4', // Cyan Border
  chart5: '#84CC16', // Light Green Leaves
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
    shadowColor: '#14532D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  elevated: {
    shadowColor: '#14532D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 5,
  },
  button: {
    shadowColor: '#14532D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
};
