import { router } from 'expo-router';
import { ArrowLeft, CalendarPlus, Clock3 } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, ErrorNotice, Field, LoadingState, Screen } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { request } from '@/lib/api';
import { useData } from '@/lib/hooks';
import { colors, spacing, typography } from '@/theme';

type Connection = {
  id: number;
  status: string;
  tutor_id: number;
  student_id: number;
  tutor_name?: string;
  student_name?: string;
};

type Availability = {
  key: string;
  timezone: string;
  slots: { id?: number; startTime: string; endTime: string }[];
};

export default function NewSessionScreen() {
  const { user } = useAuth();
  const connections = useData<Connection[]>(() => request('/connections/my-connections'), []);
  const [selected, setSelected] = useState<number | null>(null);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [form, setForm] = useState({
    title: '', subject: '', scheduledDate: '', startTime: '', endTime: '', description: '', meetingLink: '', recurrenceCount: '1',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const accepted = useMemo(() => (connections.data || []).filter((item) => item.status === 'accepted'), [connections.data]);
  const connection = accepted.find((item) => item.id === selected);
  const tutorId = user?.role === 'tutor' ? user.id : connection?.tutor_id;
  const availabilityKey = tutorId && /^\d{4}-\d{2}-\d{2}$/.test(form.scheduledDate)
    ? `${tutorId}:${form.scheduledDate}`
    : '';
  const shownAvailability = availability?.key === availabilityKey ? availability : null;
  const availabilityLoading = Boolean(availabilityKey && !shownAvailability);

  useEffect(() => {
    let active = true;
    if (!availabilityKey || !tutorId) return () => { active = false; };
    request<Availability>(`/availability/tutor/${tutorId}?date=${encodeURIComponent(form.scheduledDate)}`)
      .then((result) => { if (active) setAvailability({ ...result, key: availabilityKey }); })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : 'Unable to load tutor availability'); });
    return () => { active = false; };
  }, [availabilityKey, form.scheduledDate, tutorId]);

  if (connections.loading) return <LoadingState />;
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const chooseSlot = (slot: Availability['slots'][number]) => {
    setForm((current) => ({ ...current, startTime: slot.startTime, endTime: slot.endTime }));
    setError('');
  };
  const create = async () => {
    setSaving(true);
    setError('');
    try {
      await request('/sessions', { method: 'POST', body: JSON.stringify({ ...form, recurrenceCount: Number(form.recurrenceCount), connectionId: selected }) });
      router.replace('/(app)/(tabs)/schedule');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to schedule session');
    } finally {
      setSaving(false);
    }
  };

  return <Screen>
    <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.back}><ArrowLeft size={22} color={colors.ink} /></Pressable>
    <View style={styles.icon}><CalendarPlus size={27} color={colors.brand} /></View>
    <Text style={styles.title}>Plan a session</Text>
    <Text style={styles.copy}>Choose a connected person and a time inside the tutor’s published availability.</Text>
    {error || connections.error ? <ErrorNotice message={error || connections.error} /> : null}
    <Text style={styles.label}>Connected person</Text>
    <View style={styles.connections}>{accepted.map((item) => {
      const name = item.tutor_name || item.student_name || 'Connection';
      return <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected === item.id }} key={item.id} onPress={() => setSelected(item.id)} style={[styles.connection, selected === item.id && styles.selected]}><Text style={[styles.connectionName, selected === item.id && styles.selectedText]}>{name}</Text></Pressable>;
    })}</View>
    {!accepted.length ? <Card tone="gold"><Text style={styles.cardTitle}>No accepted connections yet</Text><Text style={styles.copy}>Connect with a tutor or accept a student request before planning a session.</Text></Card> : null}
    <Field label="Session title" value={form.title} onChangeText={(value) => set('title', value)} placeholder="Algebra practice" />
    <Field label="Subject" value={form.subject} onChangeText={(value) => set('subject', value)} />
    <Field label="Date (YYYY-MM-DD)" value={form.scheduledDate} onChangeText={(value) => set('scheduledDate', value)} placeholder="2026-09-25" autoCapitalize="none" keyboardType="numbers-and-punctuation" />
    {availabilityLoading ? <Text style={styles.availabilityText}>Checking the tutor’s schedule...</Text> : null}
    {shownAvailability ? <Card tone={shownAvailability.slots.length ? 'brand' : 'gold'}>
      <View style={styles.availabilityHeading}><Clock3 size={19} color={colors.brand} /><Text style={styles.cardTitle}>{shownAvailability.slots.length ? 'Published windows' : 'No window published for this day'}</Text></View>
      <Text style={styles.copy}>Times use the tutor’s timezone: {shownAvailability.timezone || 'UTC'}.</Text>
      {shownAvailability.slots.length ? <View style={styles.slotList}>{shownAvailability.slots.map((slot, index) => <Pressable accessibilityRole="button" key={slot.id || `${slot.startTime}-${index}`} onPress={() => chooseSlot(slot)} style={[styles.slot, form.startTime === slot.startTime && form.endTime === slot.endTime && styles.slotSelected]}><Text style={[styles.slotText, form.startTime === slot.startTime && form.endTime === slot.endTime && styles.slotTextSelected]}>{slot.startTime}–{slot.endTime}</Text></Pressable>)}</View> : <Text style={styles.copy}>Choose another date or ask the tutor to update their availability.</Text>}
    </Card> : null}
    <View style={styles.times}><View style={styles.flex}><Field label="Start (HH:MM)" value={form.startTime} onChangeText={(value) => set('startTime', value)} placeholder="16:00" /></View><View style={styles.flex}><Field label="End (HH:MM)" value={form.endTime} onChangeText={(value) => set('endTime', value)} placeholder="17:00" /></View></View>
    <Field label="What will you work on?" value={form.description} onChangeText={(value) => set('description', value)} multiline />
    {user?.role === 'tutor' ? <><Text style={styles.label}>Repeat weekly</Text><View style={styles.repeatOptions}>{['1', '2', '4', '6', '8', '12'].map((count) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: form.recurrenceCount === count }} key={count} onPress={() => set('recurrenceCount', count)} style={[styles.repeatOption, form.recurrenceCount === count && styles.slotSelected]}><Text style={[styles.slotText, form.recurrenceCount === count && styles.slotTextSelected]}>{count === '1' ? 'Once' : `${count}x`}</Text></Pressable>)}</View><Text style={styles.copy}>Every weekly date must fit your published availability and be conflict-free.</Text><Field label="Custom meeting link (optional)" value={form.meetingLink} onChangeText={(value) => set('meetingLink', value)} placeholder="Leave blank for managed Zoom" autoCapitalize="none" /><Text style={styles.copy}>A separate secure Zoom room is prepared for each session when the integration is connected.</Text></> : null}
    <Button label={user?.role === 'tutor' ? 'Schedule session' : 'Request session'} onPress={create} loading={saving} disabled={!selected || !form.title || !form.scheduledDate || !form.startTime || !form.endTime} />
  </Screen>;
}

const styles = StyleSheet.create({
  back: { height: 44, justifyContent: 'center' },
  icon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.ink, fontFamily: typography.bold, fontSize: 31 },
  copy: { color: colors.muted, fontFamily: typography.regular, fontSize: 14, lineHeight: 21 },
  label: { color: colors.ink, fontFamily: typography.bold, fontSize: 14 },
  connections: { gap: spacing.sm },
  connection: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, borderRadius: 8, padding: spacing.lg },
  selected: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  connectionName: { color: colors.ink, fontFamily: typography.medium },
  selectedText: { color: colors.brandStrong, fontFamily: typography.bold },
  times: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  cardTitle: { color: colors.ink, fontFamily: typography.bold },
  availabilityHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  availabilityText: { color: colors.brandStrong, fontFamily: typography.medium, fontSize: 13 },
  slotList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  slot: { minHeight: 44, justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: '#BFD7D2', backgroundColor: colors.surface, paddingHorizontal: spacing.md },
  slotSelected: { backgroundColor: colors.brand, borderColor: colors.brand },
  slotText: { color: colors.brandStrong, fontFamily: typography.bold },
  slotTextSelected: { color: colors.white },
  repeatOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  repeatOption: { minWidth: 54, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
});
