import { router } from 'expo-router';
import { CalendarDays, CalendarSync, ExternalLink, Plus, RefreshCw, Unplug } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SessionCard } from '@/components/DashboardBits';
import { Button, Card, EmptyState, ErrorNotice, Header, LoadingState, Screen } from '@/components/ui';
import { request } from '@/lib/api';
import { useData } from '@/lib/hooks';
import { colors, spacing, typography } from '@/theme';
import type { Session } from '@/types';

const filters = ['Upcoming', 'All', 'Completed'];
type GoogleStatus = {
  configured: boolean;
  connected: boolean;
  integration?: { syncEnabled: boolean } | null;
};

export default function ScheduleScreen() {
  const [filter, setFilter] = useState('Upcoming');
  const [integrationBusy, setIntegrationBusy] = useState(false);
  const [integrationError, setIntegrationError] = useState('');
  const state = useData<Session[]>(() => request('/sessions'), []);
  const google = useData<GoogleStatus>(() => request('/google/status'), []);
  const reloadGoogleRef = useRef(google.reload);

  useEffect(() => { reloadGoogleRef.current = google.reload; }, [google.reload]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') reloadGoogleRef.current();
    });
    return () => subscription.remove();
  }, []);

  const sessions = useMemo(() => (state.data || [])
    .filter((session) => filter === 'All' || (filter === 'Completed'
      ? session.status === 'completed'
      : session.status === 'scheduled' && new Date(`${session.scheduled_date}T23:59:59`) >= new Date()))
    .sort((a, b) => `${a.scheduled_date}${a.start_time}`.localeCompare(`${b.scheduled_date}${b.start_time}`)), [filter, state.data]);

  const connectGoogle = async () => {
    setIntegrationBusy(true);
    setIntegrationError('');
    try {
      const response = await request<{ authUrl: string }>('/google/auth-url?client=mobile');
      await Linking.openURL(response.authUrl);
    } catch (error) {
      setIntegrationError(error instanceof Error ? error.message : 'Unable to connect Google Calendar');
    } finally {
      setIntegrationBusy(false);
    }
  };

  const toggleGoogle = async () => {
    setIntegrationBusy(true);
    setIntegrationError('');
    try {
      const enabled = !google.data?.integration?.syncEnabled;
      await request('/google/sync-toggle', { method: 'POST', body: JSON.stringify({ enabled }) });
      google.reload();
    } catch (error) {
      setIntegrationError(error instanceof Error ? error.message : 'Unable to update calendar sync');
    } finally {
      setIntegrationBusy(false);
    }
  };

  const disconnectGoogle = async () => {
    setIntegrationBusy(true);
    setIntegrationError('');
    try {
      await request('/google/disconnect', { method: 'POST' });
      google.reload();
    } catch (error) {
      setIntegrationError(error instanceof Error ? error.message : 'Unable to disconnect Google Calendar');
    } finally {
      setIntegrationBusy(false);
    }
  };

  const reload = () => {
    state.reload();
    google.reload();
  };

  if (state.loading) return <LoadingState />;
  return <Screen refreshing={state.refreshing || google.refreshing} onRefresh={reload}>
    <Header
      eyebrow="Tutoring calendar"
      title="Schedule"
      subtitle="Sessions, confirmations, meeting links, and learning outcomes."
      action={<Pressable accessibilityLabel="Plan a session" style={styles.add} onPress={() => router.push('/(app)/new-session')}><Plus size={21} color={colors.white} /></Pressable>}
    />
    {google.data ? <Card style={styles.integration}>
      <View style={styles.integrationHeader}>
        <View style={styles.integrationIcon}><CalendarSync size={22} color={colors.brand} /></View>
        <View style={styles.integrationCopy}>
          <Text style={styles.integrationTitle}>Google Calendar</Text>
          <Text style={styles.integrationText}>{google.data.connected
            ? `Session sync is ${google.data.integration?.syncEnabled ? 'on' : 'paused'}.`
            : google.data.configured ? 'Connect once to sync confirmed sessions.' : 'Calendar connection is coming soon.'}</Text>
        </View>
      </View>
      {!google.data.connected && google.data.configured ? <Button label="Connect Google Calendar" icon={ExternalLink} onPress={connectGoogle} loading={integrationBusy} /> : null}
      {google.data.connected ? <View style={styles.integrationActions}>
        <Button label={google.data.integration?.syncEnabled ? 'Pause sync' : 'Resume sync'} icon={RefreshCw} variant="secondary" onPress={toggleGoogle} loading={integrationBusy} style={styles.flex} />
        <Button label="Disconnect" icon={Unplug} variant="ghost" onPress={disconnectGoogle} disabled={integrationBusy} style={styles.flex} />
      </View> : null}
    </Card> : null}
    {integrationError ? <ErrorNotice message={integrationError} /> : null}
    <View style={styles.filters}>{filters.map((item) => <Pressable key={item} onPress={() => setFilter(item)} style={[styles.filter, filter === item && styles.activeFilter]}><Text style={[styles.filterText, filter === item && styles.activeFilterText]}>{item}</Text></Pressable>)}</View>
    {state.error ? <ErrorNotice message={state.error} /> : null}
    {sessions.length ? sessions.map((session) => <Pressable key={session.id} onPress={() => router.push({ pathname: '/(app)/session/[id]', params: { id: session.id } })}><SessionCard session={session} /></Pressable>) : <EmptyState icon={CalendarDays} title={`No ${filter.toLowerCase()} sessions`} message="Sessions you plan with a connected tutor or student will appear here." action={<Button label="Plan a session" onPress={() => router.push('/(app)/new-session')} />} />}
  </Screen>;
}

const styles = StyleSheet.create({
  add: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  integration: { gap: spacing.md },
  integrationHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  integrationIcon: { width: 44, height: 44, borderRadius: 8, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  integrationCopy: { flex: 1, gap: 3 },
  integrationTitle: { color: colors.ink, fontFamily: typography.bold, fontSize: 16 },
  integrationText: { color: colors.muted, fontFamily: typography.regular, fontSize: 13, lineHeight: 19 },
  integrationActions: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  filters: { flexDirection: 'row', padding: 4, backgroundColor: '#ECE8E0', borderRadius: 8 },
  filter: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  activeFilter: { backgroundColor: colors.surface },
  filterText: { color: colors.muted, fontFamily: typography.medium, fontSize: 13 },
  activeFilterText: { color: colors.ink, fontFamily: typography.bold }
});
