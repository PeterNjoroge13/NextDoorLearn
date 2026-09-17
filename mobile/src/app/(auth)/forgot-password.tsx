import { router } from 'expo-router';
import { ArrowLeft, MailCheck } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, ErrorNotice, Field, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { colors, spacing, typography } from '@/theme';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState(''); const [message, setMessage] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const submit = async () => { setLoading(true); setError(''); try { setMessage((await api.forgotPassword(email)).message); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to send reset link'); } finally { setLoading(false); } };
  return <Screen><Pressable onPress={() => router.back()} style={styles.back}><ArrowLeft size={22} color={colors.ink} /></Pressable><View style={styles.icon}><MailCheck size={27} color={colors.brand} /></View><Text style={styles.title}>Reset your password</Text><Text style={styles.copy}>Enter the email on your account and we’ll send a secure reset link.</Text>{error ? <ErrorNotice message={error} /> : null}{message ? <View style={styles.success}><Text style={styles.successText}>{message}</Text></View> : null}<Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" /><Button label="Send reset link" onPress={submit} loading={loading} disabled={!email} /></Screen>;
}
const styles = StyleSheet.create({ back: { height: 44, justifyContent: 'center' }, icon: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xl }, title: { fontFamily: typography.bold, color: colors.ink, fontSize: 32 }, copy: { color: colors.muted, fontFamily: typography.regular, fontSize: 16, lineHeight: 24 }, success: { padding: spacing.lg, backgroundColor: colors.brandSoft, borderRadius: 8 }, successText: { color: colors.brandStrong, lineHeight: 21 } });
