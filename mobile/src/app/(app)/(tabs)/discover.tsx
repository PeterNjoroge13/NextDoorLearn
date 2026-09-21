import { router } from 'expo-router';
import { Check, Inbox, Search, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { TutorCard } from '@/components/DashboardBits';
import { Avatar, Button, Card, Chip, EmptyState, ErrorNotice, Header, LoadingState, Screen } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { request } from '@/lib/api';
import { useData } from '@/lib/hooks';
import { colors, spacing, typography } from '@/theme';
import type { Tutor } from '@/types';

const priceOptions = [
  { value: 0, label: 'Free' },
  { value: 10, label: '$10' },
  { value: 15, label: '$15' },
  { value: 20, label: '$20' },
  { value: 25, label: '$25' },
];

export default function DiscoverScreen() {
  const { user } = useAuth();
  const isTutor = user?.role === 'tutor';
  const [query, setQuery] = useState('');
  const [maxRate, setMaxRate] = useState(25);
  const [working, setWorking] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const state = useData<any>(async () => request(isTutor ? '/requests' : '/recommendations'), [isTutor]);
  const filtered = useMemo(() => ((state.data?.recommendations || []) as Tutor[]).filter((tutor) => {
    const matchesQuery = `${tutor.name} ${(tutor.subjects || []).join(' ')} ${tutor.location || ''}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && Number(tutor.hourly_rate || 0) <= maxRate;
  }), [maxRate, query, state.data?.recommendations]);

  const respond = async (id: number, action: 'accept' | 'reject') => {
    setWorking(id);
    setNotice('');
    try {
      await request(`/requests/${id}/respond`, { method: 'POST', body: JSON.stringify({ action }) });
      setNotice(action === 'accept' ? 'Student added to your roster.' : 'Request declined.');
      state.reload();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to update request');
    } finally {
      setWorking(null);
    }
  };

  if (state.loading) return <LoadingState />;
  if (isTutor) {
    const requests = Array.isArray(state.data) ? state.data : [];
    return <Screen refreshing={state.refreshing} onRefresh={state.reload}>
      <Header eyebrow="Student connections" title="Requests" subtitle="Review each student’s goals before deciding whether you are the right fit." />
      {state.error ? <ErrorNotice message={state.error} /> : null}
      {notice ? <Card tone="brand"><Text style={styles.notice}>{notice}</Text></Card> : null}
      {requests.length ? requests.map((item: any) => <Card key={item.id}>
        <View style={styles.person}><Avatar name={item.student_name} uri={item.avatar_url} /><View style={styles.personCopy}><Text style={styles.name}>{item.student_name}</Text><Text style={styles.meta}>{item.grade_level || 'Student'}</Text></View><Chip label={item.status} tone={item.status === 'pending' ? 'gold' : 'brand'} /></View>
        <Text style={styles.goals}>{item.learning_goals || item.student_bio || 'This student has not shared a goal yet.'}</Text>
        <View style={styles.subjects}>{parseList(item.subjects_needed).map((subject: string) => <Chip key={subject} label={subject} tone="neutral" />)}</View>
        {item.status === 'pending' ? <View style={styles.actions}><Button label="Decline" icon={X} variant="secondary" onPress={() => respond(item.id, 'reject')} loading={working === item.id} style={styles.action} /><Button label="Accept" icon={Check} onPress={() => respond(item.id, 'accept')} loading={working === item.id} style={styles.action} /></View> : null}
      </Card>) : <EmptyState icon={Inbox} title="Your queue is clear" message="Keep your profile and availability current so the right students can find you." />}
    </Screen>;
  }

  return <Screen refreshing={state.refreshing} onRefresh={state.reload}>
    <Header eyebrow="Personalized matches" title="Find a tutor" subtitle="Compare fit, teaching style, availability, and cost. Every tutor is $25 per hour or less." />
    <View style={styles.search}><Search size={19} color={colors.muted} /><TextInput accessibilityLabel="Search tutors" value={query} onChangeText={setQuery} placeholder="Search subject, name, or location" placeholderTextColor="#8A948F" style={styles.searchInput} /></View>
    <View><Text style={styles.filterLabel}>Maximum hourly rate</Text><View style={styles.priceFilters}>{priceOptions.map((option) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: maxRate === option.value }} key={option.value} onPress={() => setMaxRate(option.value)} style={[styles.priceFilter, maxRate === option.value && styles.priceFilterActive]}><Text style={[styles.priceFilterText, maxRate === option.value && styles.priceFilterTextActive]}>{option.label}</Text></Pressable>)}</View></View>
    {state.error ? <ErrorNotice message={state.error} /> : null}
    {!state.data?.profileReady ? <Card tone="gold"><Text style={styles.name}>Make these matches more personal</Text><Text style={styles.meta}>Complete your student intake so we can prioritize subject, schedule, learning style, and budget fit.</Text><Button label="Complete intake" variant="secondary" onPress={() => router.push('/(app)/intake')} /></Card> : null}
    {filtered.length ? filtered.map((tutor) => <Pressable accessibilityRole="button" accessibilityLabel={`View ${tutor.name}`} key={tutor.id} onPress={() => router.push({ pathname: '/(app)/tutor/[id]', params: { id: tutor.id } })}><TutorCard tutor={tutor} /></Pressable>) : <EmptyState icon={Search} title="No tutors found in this price range" message="Try a higher rate, another subject, or join the waitlist so the team can help with a match." action={<Button label="Join matching waitlist" onPress={() => router.push('/(app)/intake')} />} />}
  </Screen>;
}

const parseList = (value: unknown) => {
  if (Array.isArray(value)) return value;
  try { return JSON.parse(String(value || '[]')); }
  catch { return String(value || '').split(',').filter(Boolean); }
};

const styles = StyleSheet.create({
  search: { height: 52, borderWidth: 1, borderColor: colors.line, borderRadius: 8, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md },
  searchInput: { flex: 1, color: colors.ink, fontFamily: typography.regular, fontSize: 15 },
  filterLabel: { color: colors.ink, fontFamily: typography.bold, fontSize: 13, marginBottom: spacing.sm },
  priceFilters: { flexDirection: 'row', gap: 6 },
  priceFilter: { flex: 1, minHeight: 42, borderWidth: 1, borderColor: colors.line, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  priceFilterActive: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  priceFilterText: { color: colors.muted, fontFamily: typography.medium, fontSize: 12 },
  priceFilterTextActive: { color: colors.brandStrong, fontFamily: typography.bold },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  personCopy: { flex: 1 },
  name: { color: colors.ink, fontFamily: typography.bold, fontSize: 16 },
  meta: { color: colors.muted, fontFamily: typography.regular, fontSize: 13, lineHeight: 19 },
  goals: { color: colors.ink, fontFamily: typography.regular, lineHeight: 21 },
  subjects: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1 },
  notice: { color: colors.brandStrong, fontFamily: typography.medium },
});
