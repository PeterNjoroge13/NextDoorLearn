import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import type { LucideIcon } from 'lucide-react-native';
import React from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { assetUrl } from '@/lib/api';
import { colors, radii, shadow, spacing, typography } from '@/theme';

export function Screen({ children, scroll = true, refreshing, onRefresh, style }: {
  children: React.ReactNode; scroll?: boolean; refreshing?: boolean; onRefresh?: () => void; style?: ViewStyle;
}) {
  const content = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      contentContainerStyle={[styles.screenContent, style]}
      refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.brand} /> : undefined}
    >{children}</ScrollView>
  ) : <View style={[styles.screenContent, styles.fill, style]}>{children}</View>;
  return <SafeAreaView edges={['top']} style={styles.safe}><KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>{content}</KeyboardAvoidingView></SafeAreaView>;
}

export function Header({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: string; subtitle?: string; action?: React.ReactNode }) {
  return <View style={styles.header}><View style={styles.headerText}>{eyebrow ? <Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text> : null}<Text style={styles.title}>{title}</Text>{subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}</View>{action}</View>;
}

export function Card({ children, style, tone = 'plain' }: { children: React.ReactNode; style?: ViewStyle; tone?: 'plain' | 'brand' | 'gold' | 'coral' }) {
  return <View style={[styles.card, tone === 'brand' && styles.brandCard, tone === 'gold' && styles.goldCard, tone === 'coral' && styles.coralCard, style]}>{children}</View>;
}

export function Button({ label, onPress, icon: Icon, variant = 'primary', loading, disabled, style }: {
  label: string; onPress: () => void; icon?: LucideIcon; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; loading?: boolean; disabled?: boolean; style?: ViewStyle;
}) {
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ disabled: Boolean(disabled || loading), busy: Boolean(loading) }}
    disabled={disabled || loading}
    onPress={() => { Haptics.selectionAsync(); onPress(); }}
    style={({ pressed }) => [styles.button, styles[`button_${variant}`], pressed && styles.pressed, (disabled || loading) && styles.disabled, style]}
  >{loading ? <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? colors.white : colors.brand} /> : <>{Icon ? <Icon size={18} strokeWidth={2} color={variant === 'primary' || variant === 'danger' ? colors.white : colors.brandStrong} /> : null}<Text style={[styles.buttonLabel, styles[`buttonLabel_${variant}`]]}>{label}</Text></>}</Pressable>;
}

export function Field({ label, error, multiline, ...props }: TextInputProps & { label: string; error?: string }) {
  return <View style={styles.fieldWrap}><Text style={styles.label}>{label}</Text><TextInput
    accessibilityLabel={label}
    placeholderTextColor="#8A948F"
    multiline={multiline}
    textAlignVertical={multiline ? 'top' : 'center'}
    style={[styles.field, multiline && styles.multiline, error && styles.fieldError]}
    {...props}
  />{error ? <Text style={styles.error}>{error}</Text> : null}</View>;
}

export function Avatar({ uri, name, size = 48 }: { uri?: string | null; name: string; size?: number }) {
  const source = assetUrl(uri);
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  return source ? <Image accessibilityLabel={`${name} profile picture`} source={{ uri: source }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.brandSoft }} contentFit="cover" /> : <View accessibilityLabel={`${name} profile picture`} style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}><Text style={[styles.avatarText, { fontSize: Math.max(12, size * 0.3) }]}>{initials}</Text></View>;
}

export function Chip({ label, tone = 'brand' }: { label: string; tone?: 'brand' | 'gold' | 'coral' | 'neutral' }) {
  return <View style={[styles.chip, styles[`chip_${tone}`]]}><Text style={[styles.chipText, tone === 'neutral' && styles.chipTextNeutral]}>{label}</Text></View>;
}

export function EmptyState({ icon: Icon, title, message, action }: { icon: LucideIcon; title: string; message: string; action?: React.ReactNode }) {
  return <View style={styles.empty}><View style={styles.emptyIcon}><Icon size={28} color={colors.brand} /></View><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyMessage}>{message}</Text>{action}</View>;
}

export function LoadingState() { return <View accessibilityRole="progressbar" accessibilityLabel="Loading" style={styles.loading}><ActivityIndicator size="large" color={colors.brand} /><Text style={styles.loadingText}>Loading your space...</Text></View>; }
export function ErrorNotice({ message }: { message: string }) { return <View accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.errorNotice}><Text style={styles.errorNoticeText}>{message}</Text></View>; }
export const SectionTitle = ({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) => <View style={styles.sectionTitleRow}><Text style={styles.sectionTitle}>{children}</Text>{action}</View>;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, fill: { flex: 1 },
  screenContent: { padding: spacing.lg, paddingBottom: 120, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md, marginTop: spacing.sm },
  headerText: { flex: 1, gap: spacing.xs }, eyebrow: { color: colors.brand, fontFamily: typography.bold, fontSize: 11, letterSpacing: 0 },
  title: { color: colors.ink, fontFamily: typography.bold, fontSize: 30, lineHeight: 36, letterSpacing: 0 },
  subtitle: { color: colors.muted, fontFamily: typography.regular, fontSize: 15, lineHeight: 22, letterSpacing: 0 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, padding: spacing.lg, gap: spacing.md, ...shadow },
  brandCard: { backgroundColor: colors.surfaceTint, borderColor: '#C7E7E1' }, goldCard: { backgroundColor: '#FFF9E9', borderColor: '#EEDCAA' }, coralCard: { backgroundColor: '#FFF4F0', borderColor: '#F0CDC4' },
  button: { minHeight: 48, borderRadius: radii.md, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 1 },
  button_primary: { backgroundColor: colors.brand, borderColor: colors.brand }, button_secondary: { backgroundColor: colors.surface, borderColor: '#BFD7D2' }, button_ghost: { backgroundColor: 'transparent', borderColor: 'transparent' }, button_danger: { backgroundColor: colors.red, borderColor: colors.red },
  buttonLabel: { fontFamily: typography.bold, fontSize: 15, letterSpacing: 0 }, buttonLabel_primary: { color: colors.white }, buttonLabel_secondary: { color: colors.brandStrong }, buttonLabel_ghost: { color: colors.brandStrong }, buttonLabel_danger: { color: colors.white },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] }, disabled: { opacity: 0.5 },
  fieldWrap: { gap: 6 }, label: { color: colors.ink, fontFamily: typography.medium, fontSize: 13 },
  field: { minHeight: 50, borderWidth: 1, borderColor: '#D8D2C8', borderRadius: radii.md, backgroundColor: colors.surface, paddingHorizontal: 14, color: colors.ink, fontFamily: typography.regular, fontSize: 16 },
  multiline: { minHeight: 112, paddingTop: 14 }, fieldError: { borderColor: colors.red }, error: { color: colors.red, fontSize: 12 },
  avatar: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandSoft }, avatarText: { color: colors.brandStrong, fontFamily: typography.bold },
  chip: { borderRadius: radii.pill, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, backgroundColor: colors.brandSoft }, chip_brand: { backgroundColor: colors.brandSoft }, chip_gold: { backgroundColor: colors.goldSoft }, chip_coral: { backgroundColor: colors.coralSoft }, chip_neutral: { backgroundColor: '#EEEAE3' }, chipText: { color: colors.brandStrong, fontFamily: typography.medium, fontSize: 12 }, chipTextNeutral: { color: colors.muted },
  empty: { alignItems: 'center', padding: spacing.xl, gap: spacing.sm }, emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandSoft }, emptyTitle: { fontFamily: typography.bold, color: colors.ink, fontSize: 18, textAlign: 'center' }, emptyMessage: { fontFamily: typography.regular, color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, backgroundColor: colors.background }, loadingText: { color: colors.muted, fontFamily: typography.medium },
  errorNotice: { backgroundColor: colors.redSoft, borderColor: '#F2C0B8', borderWidth: 1, borderRadius: radii.md, padding: spacing.md }, errorNoticeText: { color: colors.red, fontFamily: typography.medium, lineHeight: 20 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }, sectionTitle: { color: colors.ink, fontFamily: typography.bold, fontSize: 19 },
});
