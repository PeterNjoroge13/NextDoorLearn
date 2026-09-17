import { router } from 'expo-router';
import { CalendarDays, Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SessionCard } from '@/components/DashboardBits';
import { Button, EmptyState, ErrorNotice, Header, LoadingState, Screen } from '@/components/ui';
import { request } from '@/lib/api';
import { useData } from '@/lib/hooks';
import { colors, spacing, typography } from '@/theme';
import type { Session } from '@/types';

const filters = ['Upcoming', 'All', 'Completed'];
export default function ScheduleScreen() {
  const [filter, setFilter] = useState('Upcoming'); const state = useData<Session[]>(() => request('/sessions'), []);
  const sessions = useMemo(() => (state.data || []).filter((session) => filter === 'All' || (filter === 'Completed' ? session.status === 'completed' : session.status === 'scheduled' && new Date(`${session.scheduled_date}T23:59:59`) >= new Date())).sort((a, b) => `${a.scheduled_date}${a.start_time}`.localeCompare(`${b.scheduled_date}${b.start_time}`)), [filter, state.data]);
  if (state.loading) return <LoadingState />;
  return <Screen refreshing={state.refreshing} onRefresh={state.reload}><Header eyebrow="Tutoring calendar" title="Schedule" subtitle="Sessions, confirmations, meeting links, and learning outcomes." action={<Pressable style={styles.add} onPress={() => router.push('/(app)/new-session')}><Plus size={21} color={colors.white} /></Pressable>} /><View style={styles.filters}>{filters.map((item) => <Pressable key={item} onPress={() => setFilter(item)} style={[styles.filter, filter === item && styles.activeFilter]}><Text style={[styles.filterText, filter === item && styles.activeFilterText]}>{item}</Text></Pressable>)}</View>{state.error ? <ErrorNotice message={state.error} /> : null}{sessions.length ? sessions.map((session) => <Pressable key={session.id} onPress={() => router.push({ pathname: '/(app)/session/[id]', params: { id: session.id } })}><SessionCard session={session} /></Pressable>) : <EmptyState icon={CalendarDays} title={`No ${filter.toLowerCase()} sessions`} message="Sessions you plan with a connected tutor or student will appear here." action={<Button label="Plan a session" onPress={() => router.push('/(app)/new-session')} />} />}</Screen>;
}
const styles = StyleSheet.create({ add: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }, filters: { flexDirection: 'row', padding: 4, backgroundColor: '#ECE8E0', borderRadius: 8 }, filter: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 6 }, activeFilter: { backgroundColor: colors.surface }, filterText: { color: colors.muted, fontFamily: typography.medium, fontSize: 13 }, activeFilterText: { color: colors.ink, fontFamily: typography.bold } });
