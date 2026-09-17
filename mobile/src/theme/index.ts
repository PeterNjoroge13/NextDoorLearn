import { Platform } from 'react-native';

export const colors = {
  background: '#F7F4EE',
  surface: '#FFFFFF',
  surfaceTint: '#EAF7F4',
  ink: '#17201D',
  muted: '#63706B',
  line: '#E5DED2',
  brand: '#0F766E',
  brandStrong: '#115E59',
  brandSoft: '#D8F3ED',
  coral: '#D95F45',
  coralSoft: '#FBE8E2',
  gold: '#B7791F',
  goldSoft: '#FFF3CF',
  blue: '#2563EB',
  blueSoft: '#E7EEFF',
  green: '#15803D',
  red: '#B42318',
  redSoft: '#FEECE8',
  white: '#FFFFFF',
  overlay: 'rgba(23, 32, 29, 0.52)',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, hero: 44 } as const;
export const radii = { sm: 6, md: 8, lg: 12, pill: 999 } as const;
export const typography = {
  regular: Platform.select({ ios: 'Avenir Next', android: 'sans-serif', default: 'system-ui' }),
  medium: Platform.select({ ios: 'Avenir Next Medium', android: 'sans-serif-medium', default: 'system-ui' }),
  bold: Platform.select({ ios: 'Avenir Next Demi Bold', android: 'sans-serif-medium', default: 'system-ui' }),
};

export const shadow = Platform.select({
  ios: { shadowColor: '#17201D', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 7 } },
  android: { elevation: 2 },
  default: {},
});
