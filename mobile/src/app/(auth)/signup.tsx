import { router } from 'expo-router';
import { ArrowLeft, Check } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, ErrorNotice, Field, Screen } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { colors, spacing, typography } from '@/theme';

type SignupForm = {
  name: string;
  email: string;
  password: string;
  confirm: string;
  ageGroup: '' | '13-17' | '18+';
  guardianConsent: boolean;
  legalConsent: boolean;
  safetyConsent: boolean;
};

function CheckRow({ checked, label, onPress }: { checked: boolean; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onPress} style={styles.checkRow}><View style={[styles.box, checked && styles.boxChecked]}>{checked ? <Check size={15} color={colors.white} /> : null}</View><Text style={styles.checkLabel}>{label}</Text></Pressable>;
}

export default function SignupScreen() {
  const { signUp } = useAuth();
  const [form, setForm] = useState<SignupForm>({
    name: '', email: '', password: '', confirm: '', ageGroup: '',
    guardianConsent: false, legalConsent: false, safetyConsent: false,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const set = <K extends keyof SignupForm>(key: K, value: SignupForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const ready = Boolean(
    form.name && form.email && form.password.length >= 8 && form.ageGroup &&
    form.legalConsent && form.safetyConsent && (form.ageGroup !== '13-17' || form.guardianConsent)
  );

  const submit = async () => {
    if (form.password !== form.confirm) return setError('Passwords do not match');
    if (!ready || !form.ageGroup) return setError('Complete the age, legal, and safety confirmations.');
    setError('');
    setLoading(true);
    try {
      await signUp({
        name: form.name,
        email: form.email,
        password: form.password,
        ageGroup: form.ageGroup,
        guardianConsent: form.ageGroup === '13-17' ? form.guardianConsent : false,
        termsAccepted: form.legalConsent,
        privacyAccepted: form.legalConsent,
        safetyAccepted: form.safetyConsent,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create account');
    } finally {
      setLoading(false);
    }
  };

  return <Screen>
    <Pressable onPress={() => router.back()} style={styles.back}><ArrowLeft size={22} color={colors.ink} /></Pressable>
    <View style={styles.heading}><Text style={styles.eyebrow}>STUDENT SIGN-UP</Text><Text style={styles.title}>Let’s find the support that fits you.</Text><Text style={styles.subtitle}>Create your account now. A short learning-needs quiz comes next.</Text></View>
    {error ? <ErrorNotice message={error} /> : null}
    <View style={styles.form}>
      <Field label="Full name" value={form.name} onChangeText={(value) => set('name', value)} autoComplete="name" />
      <Field label="Email" value={form.email} onChangeText={(value) => set('email', value)} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <Field label="Password" value={form.password} onChangeText={(value) => set('password', value)} secureTextEntry autoComplete="new-password" />
      <Field label="Confirm password" value={form.confirm} onChangeText={(value) => set('confirm', value)} secureTextEntry />
      <View style={styles.ageWrap}><Text style={styles.label}>Age group</Text><View style={styles.ageOptions}>{(['13-17', '18+'] as const).map((value) => <Pressable key={value} onPress={() => set('ageGroup', value)} style={[styles.ageOption, form.ageGroup === value && styles.ageSelected]}><Text style={[styles.ageText, form.ageGroup === value && styles.ageTextSelected]}>{value === '18+' ? '18 or older' : '13–17'}</Text></Pressable>)}</View><Text style={styles.help}>Accounts are currently available only to people age 13 or older.</Text></View>
      {form.ageGroup === '13-17' ? <CheckRow checked={form.guardianConsent} onPress={() => set('guardianConsent', !form.guardianConsent)} label="My parent or guardian has given me permission to use NextDoorLearn." /> : null}
      <CheckRow checked={form.legalConsent} onPress={() => set('legalConsent', !form.legalConsent)} label="I agree to the Terms of Service and acknowledge the Privacy Policy." />
      <View style={styles.links}><Pressable onPress={() => Linking.openURL('https://nextdoorlearn.com/terms')}><Text style={styles.link}>Read terms</Text></Pressable><Pressable onPress={() => Linking.openURL('https://nextdoorlearn.com/privacy')}><Text style={styles.link}>Read privacy policy</Text></Pressable></View>
      <CheckRow checked={form.safetyConsent} onPress={() => set('safetyConsent', !form.safetyConsent)} label="I will follow the Community and Safety Guidelines." />
      <Pressable onPress={() => Linking.openURL('https://nextdoorlearn.com/guidelines')}><Text style={styles.link}>Read safety guidelines</Text></Pressable>
      <Button label="Create student account" onPress={submit} loading={loading} disabled={!ready} />
    </View>
    <View style={styles.tutor}><Text style={styles.tutorCopy}>Want to teach?</Text><Pressable onPress={() => router.push('/(auth)/apply-tutor')}><Text style={styles.link}>Apply as a tutor</Text></Pressable></View>
  </Screen>;
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, justifyContent: 'center' }, heading: { gap: spacing.sm }, eyebrow: { color: colors.brand, fontFamily: typography.bold, fontSize: 12 },
  title: { fontFamily: typography.bold, color: colors.ink, fontSize: 32, lineHeight: 38 }, subtitle: { fontFamily: typography.regular, color: colors.muted, fontSize: 16, lineHeight: 24 },
  form: { gap: spacing.lg }, label: { color: colors.ink, fontFamily: typography.medium, fontSize: 13 }, ageWrap: { gap: spacing.sm }, ageOptions: { flexDirection: 'row', gap: spacing.sm },
  ageOption: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 8, backgroundColor: colors.surface },
  ageSelected: { borderColor: colors.brand, backgroundColor: colors.brandSoft }, ageText: { color: colors.ink, fontFamily: typography.medium }, ageTextSelected: { color: colors.brandStrong, fontFamily: typography.bold },
  help: { color: colors.muted, fontFamily: typography.regular, fontSize: 12, lineHeight: 18 }, checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderWidth: 1, borderColor: colors.line, borderRadius: 8, backgroundColor: colors.surface, padding: spacing.md },
  box: { width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }, boxChecked: { backgroundColor: colors.brand, borderColor: colors.brand },
  checkLabel: { flex: 1, color: colors.ink, fontFamily: typography.regular, fontSize: 13, lineHeight: 19 }, links: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, marginTop: -spacing.sm },
  tutor: { flexDirection: 'row', justifyContent: 'center', gap: 6 }, tutorCopy: { color: colors.muted }, link: { color: colors.brandStrong, fontFamily: typography.bold, fontSize: 13 },
});
