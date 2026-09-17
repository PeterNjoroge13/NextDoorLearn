import { router } from 'expo-router';
import { ArrowLeft, ExternalLink, HeartHandshake, Mail, Scale, Shield } from 'lucide-react-native';
import { Linking, Pressable, StyleSheet, Text } from 'react-native';
import { FeatureRow } from '@/components/FeatureRow';
import { Card, Header, Screen } from '@/components/ui';
import { colors, typography } from '@/theme';

const WEB = 'https://next-door-learn.vercel.app';
export default function HelpScreen() {
  return <Screen><Pressable onPress={() => router.back()} style={s.back}><ArrowLeft size={22} color={colors.ink} /></Pressable><Header eyebrow="We’re here to help" title="Help and policies" subtitle="Find support and understand how NextDoorLearn protects its community." /><Card tone="brand"><Text style={s.title}>Need help with a person or session?</Text><Text style={s.copy}>Use the in-app report and block tools for safety concerns. For account support, contact the NextDoorLearn team directly.</Text></Card><Card><FeatureRow icon={Mail} title="Contact support" subtitle="Open your email app" onPress={() => Linking.openURL('mailto:support@nextdoorlearn.com?subject=NextDoorLearn%20mobile%20support')} /><FeatureRow icon={Shield} title="Privacy policy" onPress={() => Linking.openURL(`${WEB}/privacy`)} /><FeatureRow icon={Scale} title="Terms of service" onPress={() => Linking.openURL(`${WEB}/terms`)} /><FeatureRow icon={HeartHandshake} title="Community guidelines" onPress={() => Linking.openURL(`${WEB}/community-guidelines`)} /><FeatureRow icon={ExternalLink} title="Open the web app" onPress={() => Linking.openURL(WEB)} /></Card></Screen>;
}
const s = StyleSheet.create({ back: { height: 44, justifyContent: 'center' }, title: { color: colors.brandStrong, fontFamily: typography.bold, fontSize: 17 }, copy: { color: colors.muted, fontFamily: typography.regular, lineHeight: 21 } });
