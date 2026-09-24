import { Platform } from 'react-native';

export const colors = {
  background: '#F5F2EB',
  surface: '#FFFFFF',
  surfaceTint: '#E7F3EF',
  ink: '#14211D',
  muted: '#5D6A65',
  line: '#DDD7CB',
  brand: '#0B7468',
  brandStrong: '#07584F',
  brandSoft: '#D7EFE9',
  coral: '#C9543E',
  coralSoft: '#F8E3DC',
  gold: '#A96C11',
  goldSoft: '#F7EBC8',
  blue: '#356FAC',
  blueSoft: '#E2ECF7',
  green: '#267447',
  red: '#A83A30',
  redSoft: '#F7E2DE',
  white: '#FFFFFF',
  overlay: 'rgba(23, 32, 29, 0.52)',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, hero: 48 } as const;
export const radii = { sm: 4, md: 7, lg: 8, pill: 999 } as const;
export const typography = {
  regular: Platform.select({ ios: 'Avenir Next', android: 'sans-serif', default: 'system-ui' }),
  medium: Platform.select({ ios: 'Avenir Next Medium', android: 'sans-serif-medium', default: 'system-ui' }),
  bold: Platform.select({ ios: 'Avenir Next Demi Bold', android: 'sans-serif-medium', default: 'system-ui' }),
};

export const shadow = Platform.select({
  ios: { shadowColor: '#14211D', shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } },
  android: { elevation: 1 },
  default: {},
});
