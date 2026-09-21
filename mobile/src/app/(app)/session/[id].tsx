import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, CalendarClock, CalendarDays, RefreshCw, Video } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Chip, ErrorNotice, Field, LoadingState, Screen } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { request } from '@/lib/api';
import { useData } from '@/lib/hooks';
import { colors, spacing, typography } from '@/theme';
import type { Session } from '@/types';

type SessionEvent = {
  event_type: string;
  from_state?: string;
  to_state?: string;
  created_at: string;
  details?: { reason?: string };
};

const eventLabels: Record<string, string> = {
  created: 'Session requested',
  confirmed: 'Time confirmed',
  declined: 'Request declined',
  rescheduled: 'Time changed',
  cancelled: 'Session cancelled',
  outcome_recorded: 'Outcome recorded',
  student_reflection_added: 'Reflection saved',
};

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const state = useData<Session & Record<string, any>>(() => request(`/sessions/${id}/outcome`), [id]);
  const history = useData<SessionEvent[]>(() => request(`/sessions/${id}/events`), [id]);
  const [form, setForm] = useState({
    tutorSummary: '', skillsPracticed: '', nextSteps: '', studentReflection: '',
    confidenceBefore: '3', confidenceAfter: '3',
  });
  const [reschedule, setReschedule] = useState({ scheduledDate: '', startTime: '', endTime: '', reason: '' });
  const [cancellationReason, setCancellationReason] = useState('');
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [confirmingCancellation, setConfirmingCancellation] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [meetingBusy, setMeetingBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  if (state.loading) return <LoadingState />;
  if (!state.data) return <Screen><ErrorNotice message={state.error || 'Session not found'} /></Screen>;

  const item = state.data;
  const tutor = user?.role === 'tutor';
  const reload = () => { state.reload(); history.reload(); };
  const setSchedule = (key: keyof typeof reschedule, value: string) => setReschedule((current) => ({ ...current, [key]: value }));

  const confirmation = async (decision: string) => {
    setActionBusy(true); setError('');
    try {
      await request(`/sessions/${id}/confirmation`, { method: 'PATCH', body: JSON.stringify({ decision }) });
      setNotice(`Session ${decision}.`); reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update request');
    } finally { setActionBusy(false); }
  };

  const openReschedule = () => {
    setReschedule({
      scheduledDate: String(item.scheduled_date || '').slice(0, 10),
      startTime: String(item.start_time || '').slice(0, 5),
      endTime: String(item.end_time || '').slice(0, 5),
      reason: '',
    });
    setEditingSchedule(true); setConfirmingCancellation(false); setError('');
  };

  const saveReschedule = async () => {
    setActionBusy(true); setError('');
    try {
      await request(`/sessions/${id}/reschedule`, { method: 'PATCH', body: JSON.stringify(reschedule) });
      setNotice(tutor ? 'The session time was updated.' : 'The new time was sent to your tutor for confirmation.');
      setEditingSchedule(false); reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to reschedule session');
    } finally { setActionBusy(false); }
  };

  const cancel = async () => {
    setActionBusy(true); setError('');
    try {
      await request(`/sessions/${id}/status`, {
        method: 'PATCH', body: JSON.stringify({ status: 'cancelled', notes: cancellationReason }),
      });
      setNotice('Session cancelled.'); setConfirmingCancellation(false); reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to cancel session');
    } finally { setActionBusy(false); }
  };

  const openMeeting = async () => {
    setMeetingBusy(true); setError('');
    try {
      const shouldPrepare = tutor && !item.meeting_link;
      const meeting = await request<{ joinUrl?: string; startUrl?: string }>(`/sessions/${id}/meeting`, {
        method: shouldPrepare ? 'POST' : 'GET',
      });
      const url = tutor ? meeting.startUrl || meeting.joinUrl : meeting.joinUrl;
      if (!url) throw new Error('The meeting room is not ready yet.');
      await Linking.openURL(url); reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to open the meeting room');
    } finally { setMeetingBusy(false); }
  };

  const outcome = async () => {
    setActionBusy(true); setError('');
    try {
      const body = tutor
        ? { attendance: 'completed', tutorSummary: form.tutorSummary, skillsPracticed: form.skillsPracticed, nextSteps: form.nextSteps }
        : { studentReflection: form.studentReflection, confidenceBefore: Number(form.confidenceBefore), confidenceAfter: Number(form.confidenceAfter) };
      await request(`/sessions/${id}/outcome`, { method: 'PATCH', body: JSON.stringify(body) });
      setNotice(tutor ? 'Session outcome saved.' : 'Reflection saved.'); reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save outcome');
    } finally { setActionBusy(false); }
  };

  const displayStatus = item.confirmation_status === 'pending' ? 'Pending' : item.status;
  return <Screen refreshing={state.refreshing || history.refreshing} onRefresh={reload}>
    <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.back}>
      <ArrowLeft size={22} color={colors.ink} />
    </Pressable>

    <View style={styles.hero}>
      <View style={styles.icon}><CalendarDays size={25} color={colors.brand} /></View>
      <View style={styles.heroCopy}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.meta}>{String(item.scheduled_date).slice(0, 10)} · {String(item.start_time).slice(0, 5)}–{String(item.end_time).slice(0, 5)}</Text>
        <Text style={styles.timezone}>Tutor timezone: {item.session_timezone || 'UTC'}</Text>
      </View>
      <Chip label={displayStatus} tone={item.confirmation_status === 'pending' ? 'gold' : item.status === 'cancelled' ? 'coral' : 'brand'} />
    </View>

    {error || state.error || history.error ? <ErrorNotice message={error || state.error || history.error} /> : null}
    {notice ? <Card tone="brand"><Text style={styles.notice}>{notice}</Text></Card> : null}

    <Card>
      <Text style={styles.section}>Session details</Text>
      <Text style={styles.person}>{tutor ? item.student_name : item.tutor_name}</Text>
      <Text style={styles.copy}>{item.subject || 'Tutoring'}{item.description ? ` · ${item.description}` : ''}</Text>
      {item.status === 'cancelled' && item.cancellation_reason ? <Text style={styles.copy}>Reason: {item.cancellation_reason}</Text> : null}
      {item.status === 'scheduled' && item.confirmation_status === 'confirmed' && (item.meeting_link || tutor)
        ? <Button label={item.meeting_status === 'error' ? 'Retry meeting room' : item.meeting_link ? 'Open secure meeting' : 'Prepare Zoom room'} icon={item.meeting_status === 'error' ? RefreshCw : Video} variant="secondary" onPress={openMeeting} loading={meetingBusy} />
        : null}
      {item.status === 'scheduled' && item.confirmation_status === 'confirmed' && !item.meeting_link && !tutor
        ? <Text style={styles.copy}>The tutor is preparing the meeting room.</Text>
        : null}
    </Card>

    {tutor && item.confirmation_status === 'pending' ? <View style={styles.actions}>
      <Button label="Decline" variant="secondary" onPress={() => confirmation('declined')} disabled={actionBusy} style={styles.flex} />
      <Button label="Confirm" onPress={() => confirmation('confirmed')} loading={actionBusy} style={styles.flex} />
    </View> : null}

    {item.status === 'scheduled' && !editingSchedule && !confirmingCancellation ? <View style={styles.actions}>
      <Button label="Reschedule" icon={CalendarClock} variant="secondary" onPress={openReschedule} style={styles.flex} />
      <Button label="Cancel" variant="ghost" onPress={() => { setConfirmingCancellation(true); setEditingSchedule(false); }} style={styles.flex} />
    </View> : null}

    {editingSchedule ? <Card tone="gold">
      <Text style={styles.section}>Choose a new time</Text>
      {!tutor ? <Text style={styles.copy}>Your tutor must confirm the new time before calendar and meeting details are recreated.</Text> : null}
      <Field label="Date (YYYY-MM-DD)" value={reschedule.scheduledDate} onChangeText={(value) => setSchedule('scheduledDate', value)} autoCapitalize="none" />
      <View style={styles.actions}>
        <View style={styles.flex}><Field label="Start (HH:MM)" value={reschedule.startTime} onChangeText={(value) => setSchedule('startTime', value)} /></View>
        <View style={styles.flex}><Field label="End (HH:MM)" value={reschedule.endTime} onChangeText={(value) => setSchedule('endTime', value)} /></View>
      </View>
      <Field label="Reason for changing the time" value={reschedule.reason} onChangeText={(value) => setSchedule('reason', value)} multiline maxLength={500} />
      <Button label="Save new time" icon={CalendarClock} onPress={saveReschedule} loading={actionBusy} disabled={!reschedule.scheduledDate || !reschedule.startTime || !reschedule.endTime || !reschedule.reason.trim()} />
      <Button label="Keep current time" variant="ghost" onPress={() => setEditingSchedule(false)} disabled={actionBusy} />
    </Card> : null}

    {confirmingCancellation ? <Card tone="coral">
      <Text style={styles.section}>Cancel this session?</Text>
      <Text style={styles.copy}>The other person will see your reason. Meeting, reminder, and calendar details will be removed.</Text>
      <Field label="Cancellation reason" value={cancellationReason} onChangeText={setCancellationReason} multiline maxLength={500} />
      <Button label="Cancel session" variant="danger" onPress={cancel} loading={actionBusy} disabled={!cancellationReason.trim()} />
      <Button label="Keep session" variant="ghost" onPress={() => setConfirmingCancellation(false)} disabled={actionBusy} />
    </Card> : null}

    {tutor && item.status !== 'cancelled' ? <Card>
      <Text style={styles.section}>Tutor outcome</Text>
      <Text style={styles.copy}>Complete this after the session begins so the student has useful notes and next steps.</Text>
      <Field label="Session summary" value={form.tutorSummary} onChangeText={(value) => setForm((current) => ({ ...current, tutorSummary: value }))} multiline />
      <Field label="Skills practiced" value={form.skillsPracticed} onChangeText={(value) => setForm((current) => ({ ...current, skillsPracticed: value }))} />
      <Field label="Next steps" value={form.nextSteps} onChangeText={(value) => setForm((current) => ({ ...current, nextSteps: value }))} multiline />
      <Button label="Mark complete and save notes" onPress={outcome} loading={actionBusy} />
    </Card> : null}

    {!tutor && item.status === 'completed' ? <Card>
      <Text style={styles.section}>Your reflection</Text>
      {item.tutor_summary ? <Text style={styles.copy}>Tutor notes: {item.tutor_summary}</Text> : null}
      <Field label="What feels clearer now?" value={form.studentReflection} onChangeText={(value) => setForm((current) => ({ ...current, studentReflection: value }))} multiline />
      <View style={styles.actions}>
        <View style={styles.flex}><Field label="Confidence before (1–5)" value={form.confidenceBefore} onChangeText={(value) => setForm((current) => ({ ...current, confidenceBefore: value }))} keyboardType="number-pad" /></View>
        <View style={styles.flex}><Field label="Confidence after (1–5)" value={form.confidenceAfter} onChangeText={(value) => setForm((current) => ({ ...current, confidenceAfter: value }))} keyboardType="number-pad" /></View>
      </View>
      <Button label="Save reflection" onPress={outcome} loading={actionBusy} />
    </Card> : null}

    {history.data?.length ? <Card>
      <Text style={styles.section}>Session history</Text>
      {history.data.map((event, index) => <View style={styles.historyRow} key={`${event.event_type}-${event.created_at}-${index}`}>
        <View style={styles.historyDot} />
        <View style={styles.historyCopy}>
          <Text style={styles.historyTitle}>{eventLabels[event.event_type] || event.event_type.replaceAll('_', ' ')}</Text>
          {event.details?.reason ? <Text style={styles.copy}>{event.details.reason}</Text> : null}
          <Text style={styles.historyDate}>{new Date(event.created_at).toLocaleString()}</Text>
        </View>
      </View>)}
    </Card> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, justifyContent: 'center' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { width: 48, height: 48, borderRadius: 8, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  heroCopy: { flex: 1, gap: 3 },
  title: { color: colors.ink, fontFamily: typography.bold, fontSize: 23 },
  meta: { color: colors.muted, fontFamily: typography.regular, fontSize: 12 },
  timezone: { color: colors.brandStrong, fontFamily: typography.medium, fontSize: 11 },
  notice: { color: colors.brandStrong, fontFamily: typography.medium },
  section: { color: colors.ink, fontFamily: typography.bold, fontSize: 17 },
  person: { color: colors.ink, fontFamily: typography.medium, fontSize: 15 },
  copy: { color: colors.muted, fontFamily: typography.regular, lineHeight: 21 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  historyRow: { flexDirection: 'row', gap: spacing.sm },
  historyDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.brand, marginTop: 5 },
  historyCopy: { flex: 1, gap: 3 },
  historyTitle: { color: colors.ink, fontFamily: typography.medium, textTransform: 'capitalize' },
  historyDate: { color: colors.muted, fontFamily: typography.regular, fontSize: 12 },
});
