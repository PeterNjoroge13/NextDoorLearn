import { Image } from 'expo-image';
import { router } from 'expo-router';
import { BookOpen, HeartHandshake, LogIn } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii, spacing, typography } from '@/theme';

export default function WelcomeScreen() {
  return <View style={styles.page}>
    <Image source={require('../../../assets/images/community-learning-hero.png')} style={styles.hero} contentFit="cover" />
    <View style={styles.scrim} />
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} bounces={false}>
        <View style={styles.brand}><View style={styles.mark}><BookOpen size={20} color={colors.white} /></View><Text style={styles.brandText}>NextDoorLearn</Text></View>
        <View style={styles.main}>
          <View style={styles.copy}><Text style={styles.eyebrow}>TUTORING WITHIN REACH</Text><Text style={styles.title}>The right help can change what feels possible.</Text><Text style={styles.body}>We connect students who face cost and access barriers with caring tutors ready to teach for free or at a low cost.</Text></View>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" style={styles.primary} onPress={() => router.push('/(auth)/signup')}><Text style={styles.primaryText}>Find a tutor</Text></Pressable>
            <Pressable accessibilityRole="button" style={styles.secondary} onPress={() => router.push('/(auth)/login')}><LogIn size={18} color={colors.ink} /><Text style={styles.secondaryText}>Sign in</Text></Pressable>
            <View style={styles.inline}><Pressable accessibilityRole="link" onPress={() => router.push('/(auth)/apply-tutor')}><Text style={styles.link}>Volunteer as a tutor</Text></Pressable><Text style={styles.dot}>•</Text><Pressable accessibilityRole="link" style={styles.sponsorLink} onPress={() => router.push('/(auth)/donate')}><HeartHandshake size={15} color={colors.white} /><Text style={styles.link}>Sponsor access</Text></Pressable></View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ink }, hero: { ...StyleSheet.absoluteFill }, scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(16, 28, 24, 0.55)' }, safe: { flex: 1 }, content: { flexGrow: 1, padding: spacing.xl }, main: { marginTop: 'auto', gap: spacing.xl },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 }, mark: { width: 38, height: 38, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand }, brandText: { color: colors.white, fontFamily: typography.bold, fontSize: 18 },
  copy: { gap: spacing.md, marginTop: spacing.xxl }, eyebrow: { color: '#BFE8E1', fontFamily: typography.bold, fontSize: 12, letterSpacing: 0 }, title: { color: colors.white, fontFamily: typography.bold, fontSize: 39, lineHeight: 44, letterSpacing: 0 }, body: { color: '#F4F1EA', fontFamily: typography.regular, fontSize: 17, lineHeight: 25 },
  actions: { gap: spacing.md }, primary: { minHeight: 54, borderRadius: radii.md, backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center' }, primaryText: { color: colors.white, fontFamily: typography.bold, fontSize: 16 }, secondary: { minHeight: 54, borderRadius: radii.md, backgroundColor: colors.white, flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center' }, secondaryText: { color: colors.ink, fontFamily: typography.bold, fontSize: 16 }, inline: { minHeight: 36, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: spacing.sm }, sponsorLink: { flexDirection: 'row', alignItems: 'center', gap: 5 }, link: { color: colors.white, fontFamily: typography.medium, fontSize: 14, textDecorationLine: 'underline' }, dot: { color: colors.white },
});
