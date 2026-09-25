import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, CheckCircle2, Flag, ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, ErrorNotice, Field, Header, Screen } from '@/components/ui';
import { request } from '@/lib/api';
import { colors, spacing, typography } from '@/theme';

const reasons = [
  'Harassment or bullying',
  'Unsafe or inappropriate conduct',
  'Spam or scam',
  'False profile information',
  'Other concern',
];

export default function ReportUserScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const [reason, setReason] = useState(reasons[0]);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setSubmitting(true);
    setError('');
    try {
      await request('/reports', {
        method: 'POST',
        body: JSON.stringify({ reportedUserId: Number(id), reason, details: details.trim() }),
      });
      setSubmitted(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Your report could not be submitted.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return <Screen>
      <Card tone="brand" style={styles.successCard}>
        <CheckCircle2 size={34} color={colors.brand} />
        <Text style={styles.successTitle}>Report received</Text>
        <Text style={styles.copy}>The moderation team has been notified. Reports are private, and retaliation is not allowed.</Text>
        <Button label="Done" onPress={() => router.back()} />
      </Card>
    </Screen>;
  }

  return <Screen>
    <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.back}>
      <ArrowLeft size={22} color={colors.ink} />
    </Pressable>
    <Header
      eyebrow="Private safety report"
      title={`Report ${name || 'this user'}`}
      subtitle="Share enough context for the moderation team to review the concern promptly."
    />
    {error ? <ErrorNotice message={error} /> : null}
    <Card tone="coral">
      <View style={styles.noticeHead}><ShieldCheck size={21} color={colors.red} /><Text style={styles.noticeTitle}>For immediate danger</Text></View>
      <Text style={styles.copy}>Contact 911 or the appropriate local emergency service first. NextDoorLearn is not an emergency service.</Text>
    </Card>
    <View style={styles.section}>
      <Text style={styles.label}>What happened?</Text>
      <View style={styles.reasons}>
        {reasons.map((item) => (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected: reason === item }}
            key={item}
            onPress={() => setReason(item)}
            style={[styles.reason, reason === item && styles.reasonSelected]}
          >
            <Text style={[styles.reasonText, reason === item && styles.reasonTextSelected]}>{item}</Text>
          </Pressable>
        ))}
      </View>
    </View>
    <Field
      label="Details"
      value={details}
      onChangeText={setDetails}
      placeholder="Describe what happened, when it happened, and any session or message involved."
      multiline
      maxLength={2000}
    />
    <Text style={styles.privacy}>Your report is shared only with authorized moderators. The reported user is not told who submitted it.</Text>
    <Button label="Submit private report" icon={Flag} variant="danger" onPress={submit} loading={submitting} disabled={details.trim().length < 10} />
  </Screen>;
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, justifyContent: 'center' },
  section: { gap: spacing.sm },
  label: { color: colors.ink, fontFamily: typography.bold, fontSize: 14 },
  reasons: { gap: spacing.sm },
  reason: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: 8, backgroundColor: colors.surface },
  reasonSelected: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  reasonText: { color: colors.ink, fontFamily: typography.medium, fontSize: 14 },
  reasonTextSelected: { color: colors.brandStrong, fontFamily: typography.bold },
  noticeHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  noticeTitle: { color: colors.red, fontFamily: typography.bold, fontSize: 16 },
  copy: { color: colors.muted, fontFamily: typography.regular, lineHeight: 21 },
  privacy: { color: colors.muted, fontFamily: typography.regular, fontSize: 12, lineHeight: 18 },
  successCard: { marginTop: spacing.xl, alignItems: 'center' },
  successTitle: { color: colors.ink, fontFamily: typography.bold, fontSize: 24 },
});
