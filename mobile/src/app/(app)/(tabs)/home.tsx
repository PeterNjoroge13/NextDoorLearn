import { router } from 'expo-router';
import { CalendarDays, HeartHandshake, Inbox, MessageCircle, Sparkles, Target, Users } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SessionCard, Stat, TutorCard } from '@/components/DashboardBits';
import { Button, Card, ErrorNotice, Header, LoadingState, Screen, SectionTitle } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { request } from '@/lib/api';
import { useData } from '@/lib/hooks';
import { colors, spacing, typography } from '@/theme';
import type { Session, Tutor } from '@/types';

type DashboardData = { profile: any; completion: any; sessions: Session[]; stats: any; messageStats: any; roleData: any };
export default function HomeScreen() {
  const { user } = useAuth(); const isTutor = user?.role === 'tutor';
  const state = useData<DashboardData>(async () => {
    const [profile, completion, sessions, stats, messageStats, roleData] = await Promise.all([
      request('/users/profile'), request('/users/profile-completion'), request('/sessions/upcoming?limit=5'), request('/sessions/stats'), request('/messages/stats'), request(isTutor ? '/requests' : '/recommendations')
    ]);
    return { profile, completion, sessions, stats, messageStats, roleData } as DashboardData;
  }, [isTutor]);
  if (state.loading) return <LoadingState />;
  const firstName = user?.name.split(' ')[0] || 'there'; const sessions = state.data?.sessions || []; const stats = state.data?.stats || {}; const messages = state.data?.messageStats || {};
  const requests = isTutor && Array.isArray(state.data?.roleData) ? state.data.roleData : []; const pending = requests.filter((item: any) => item.status === 'pending'); const tutors: Tutor[] = !isTutor ? state.data?.roleData?.recommendations || [] : [];
  return <Screen refreshing={state.refreshing} onRefresh={state.reload}>
    <View style={[styles.hero, isTutor && styles.heroTutor]}>
      <Header eyebrow={isTutor ? 'Your teaching workspace' : 'Your learning home'} title={isTutor ? `Your time can change someone’s week, ${firstName}.` : `What can we make easier today, ${firstName}?`} subtitle={isTutor ? 'Prepare for sessions, respond to students, and keep your availability current.' : 'Find the right person and take the next small step toward your goals.'} action={<View style={[styles.spark, isTutor && styles.sparkTutor]}><Sparkles size={19} color={isTutor ? colors.coral : colors.brand} /></View>} />
      <Button label={isTutor ? 'Review student requests' : 'Find the right tutor'} variant={isTutor ? 'secondary' : 'primary'} onPress={() => router.push('/(app)/(tabs)/discover')} />
    </View>
    {state.error ? <ErrorNotice message={state.error} /> : null}
    {!user?.emailVerified ? <Card tone="gold"><Text style={styles.noticeTitle}>Verify your email</Text><Text style={styles.noticeCopy}>Check your inbox to unlock messaging and connection requests.</Text></Card> : null}
    <View style={styles.stats}>{isTutor ? <><Stat icon={Users} value={messages.peopleHelped || 0} label="Students supported" /><Stat icon={CalendarDays} value={stats.completed_sessions || 0} label="Sessions completed" tone="blue" /><Stat icon={Inbox} value={pending.length} label="Requests waiting" tone="coral" /><Stat icon={HeartHandshake} value={`${Math.round((stats.total_minutes_taught || 0) / 6) / 10}h`} label="Time given" tone="gold" /></> : <><Stat icon={Users} value={messages.peopleHelped || 0} label="Tutors in your circle" /><Stat icon={CalendarDays} value={stats.scheduled_sessions || 0} label="Sessions ahead" tone="blue" /><Stat icon={Target} value={stats.reflections_completed || 0} label="Reflections" tone="gold" /><Stat icon={MessageCircle} value={messages.messagesSent || 0} label="Messages sent" tone="coral" /></>}</View>
    {isTutor && pending.length ? <View style={styles.section}><SectionTitle action={<Pressable onPress={() => router.push('/(app)/(tabs)/discover')}><Text style={styles.link}>View all</Text></Pressable>}>Needs your attention</SectionTitle>{pending.slice(0, 2).map((item: any) => <Card key={item.id}><View style={styles.requestTop}><View style={styles.requestCopy}><Text style={styles.cardTitle}>{item.student_name}</Text><Text style={styles.meta}>{item.grade_level || 'Student'} · {parseList(item.subjects_needed).slice(0, 2).join(', ') || 'Learning support'}</Text></View><Button label="Review" variant="secondary" onPress={() => router.push('/(app)/(tabs)/discover')} /></View></Card>)}</View> : null}
    <View style={styles.section}><SectionTitle action={<Pressable onPress={() => router.push('/(app)/(tabs)/schedule')}><Text style={styles.link}>Full schedule</Text></Pressable>}>Coming up</SectionTitle>{sessions.length ? sessions.slice(0, 3).map((session) => <SessionCard key={session.id} session={session} />) : <Card><Text style={styles.cardTitle}>Nothing scheduled yet</Text><Text style={styles.meta}>{isTutor ? 'Accepted students can plan sessions around your availability.' : 'Connect with a tutor, then choose a time that works for both of you.'}</Text><Button label={isTutor ? 'Set availability' : 'Find a tutor'} variant="secondary" onPress={() => router.push(isTutor ? '/(app)/availability' : '/(app)/(tabs)/discover')} /></Card>}</View>
    {!isTutor ? <View style={styles.section}><SectionTitle action={<Pressable onPress={() => router.push('/(app)/(tabs)/discover')}><Text style={styles.link}>See every tutor</Text></Pressable>}>Picked for your goals</SectionTitle>{tutors.length ? tutors.slice(0, 3).map((tutor) => <Pressable key={tutor.id} onPress={() => router.push({ pathname: '/(app)/tutor/[id]', params: { id: tutor.id } })}><TutorCard tutor={tutor} /></Pressable>) : <Card tone="brand"><Text style={styles.cardTitle}>Tell us what you need</Text><Text style={styles.meta}>Complete your learning-needs quiz to get better recommendations.</Text><Button label="Start intake quiz" onPress={() => router.push('/(app)/intake')} /></Card>}</View> : null}
    <Card tone={isTutor ? 'brand' : 'gold'}><Text style={styles.cardTitle}>{isTutor ? 'Keep your tutor profile ready' : 'Build a learning plan that feels doable'}</Text><Text style={styles.meta}>{isTutor ? `${state.data?.completion?.percentage || 0}% complete. Strong profiles make it easier for students to know you can help.` : 'Turn a big academic goal into clear milestones you can share with your tutor.'}</Text><Button label={isTutor ? 'Strengthen profile' : 'Track progress'} variant="secondary" onPress={() => router.push(isTutor ? '/(app)/profile' : '/(app)/progress')} /></Card>
  </Screen>;
}
const parseList = (value: unknown) => { if (Array.isArray(value)) return value; try { return JSON.parse(String(value || '[]')); } catch { return String(value || '').split(',').filter(Boolean); } };
const styles = StyleSheet.create({
  hero: { gap: spacing.lg, padding: spacing.lg, borderWidth: 1, borderLeftWidth: 4, borderColor: '#BEDFD7', borderLeftColor: colors.brand, borderRadius: 7, backgroundColor: colors.surfaceTint },
  heroTutor: { borderColor: '#C6D5E5', borderLeftColor: colors.coral, backgroundColor: '#EAF0F7' },
  spark: { width: 42, height: 42, borderRadius: 7, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }, sparkTutor: { backgroundColor: colors.coralSoft },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, section: { gap: spacing.md }, link: { color: colors.brandStrong, fontFamily: typography.bold, fontSize: 13 }, noticeTitle: { color: colors.gold, fontFamily: typography.bold }, noticeCopy: { color: colors.muted, lineHeight: 20 }, cardTitle: { color: colors.ink, fontFamily: typography.bold, fontSize: 17 }, meta: { color: colors.muted, fontFamily: typography.regular, fontSize: 13, lineHeight: 20 }, requestTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md }, requestCopy: { flex: 1, gap: 4 }
});
