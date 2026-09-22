import { router } from 'expo-router';
import { ArrowLeft, BookOpen } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, ErrorNotice, Field, Screen } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { colors, spacing, typography } from '@/theme';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const submit = async () => { setError(''); setLoading(true); try { await signIn(email, password); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to sign in'); } finally { setLoading(false); } };
  return <Screen><Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.back}><ArrowLeft size={22} color={colors.ink} /></Pressable><View style={styles.mark}><BookOpen color={colors.white} size={25} /></View><View style={styles.heading}><Text style={styles.title}>Welcome back.</Text><Text style={styles.subtitle}>Your tutors, students, messages, and plans are waiting.</Text></View>{error ? <ErrorNotice message={error} /> : null}<View style={styles.form}><Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" returnKeyType="next" /><Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" returnKeyType="done" onSubmitEditing={submit} /><Button label="Sign in" onPress={submit} loading={loading} disabled={!email || !password} /></View><Pressable accessibilityRole="link" onPress={() => router.push('/(auth)/forgot-password')}><Text style={styles.link}>Forgot your password?</Text></Pressable><View style={styles.switch}><Text style={styles.switchCopy}>New to NextDoorLearn?</Text><Pressable accessibilityRole="link" onPress={() => router.push('/(auth)/signup')}><Text style={styles.link}>Create a student account</Text></Pressable></View></Screen>;
}
const styles = StyleSheet.create({ back: { width: 44, height: 44, justifyContent: 'center' }, mark: { width: 54, height: 54, borderRadius: 12, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg }, heading: { gap: spacing.sm }, title: { fontFamily: typography.bold, color: colors.ink, fontSize: 34 }, subtitle: { fontFamily: typography.regular, color: colors.muted, fontSize: 16, lineHeight: 24 }, form: { gap: spacing.lg }, link: { color: colors.brandStrong, fontFamily: typography.bold, fontSize: 14 }, switch: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, switchCopy: { color: colors.muted, fontFamily: typography.regular } });
