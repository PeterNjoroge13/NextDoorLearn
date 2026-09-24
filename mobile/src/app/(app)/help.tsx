import { router } from 'expo-router';
import { ArrowLeft, ExternalLink, HeartHandshake, Scale, Shield, UserRound } from 'lucide-react-native';
import { Linking, Pressable, StyleSheet, Text } from 'react-native';
import { FeatureRow } from '@/components/FeatureRow';
import { Card, Header, Screen } from '@/components/ui';
import { colors, typography } from '@/theme';

const WEB = 'https://www.nextdoorlearn.com';
export default function HelpScreen() {
  return <Screen><Pressable onPress={() => router.back()} style={s.back}><ArrowLeft size={22} color={colors.ink} /></Pressable><Header eyebrow="We’re here to help" title="Help and policies" subtitle="Find support and understand how NextDoorLearn protects its community." /><Card tone="brand"><Text style={s.title}>Need help with a person or session?</Text><Text style={s.copy}>Use the in-app report and block tools for safety concerns. For account support during beta, contact founder Peter Njoroge directly.</Text></Card><Card><FeatureRow icon={UserRound} title="Contact Peter on LinkedIn" subtitle="Open the founder’s verified profile" onPress={() => Linking.openURL('https://www.linkedin.com/in/peter-njoroge13')} /><FeatureRow icon={Shield} title="Privacy policy" onPress={() => Linking.openURL(`${WEB}/privacy`)} /><FeatureRow icon={Scale} title="Terms of service" onPress={() => Linking.openURL(`${WEB}/terms`)} /><FeatureRow icon={HeartHandshake} title="Community guidelines" onPress={() => Linking.openURL(`${WEB}/guidelines`)} /><FeatureRow icon={ExternalLink} title="Open the web app" onPress={() => Linking.openURL(WEB)} /></Card></Screen>;
}
const s = StyleSheet.create({ back: { height: 44, justifyContent: 'center' }, title: { color: colors.brandStrong, fontFamily: typography.bold, fontSize: 17 }, copy: { color: colors.muted, fontFamily: typography.regular, lineHeight: 21 } });
