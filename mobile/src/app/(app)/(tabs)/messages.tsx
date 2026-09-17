import { router } from 'expo-router';
import { MessageCircle } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar, EmptyState, ErrorNotice, Header, LoadingState, Screen } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { request } from '@/lib/api';
import { useData } from '@/lib/hooks';
import { colors, spacing, typography } from '@/theme';
import type { Conversation } from '@/types';

export default function MessagesScreen() {
  const { user } = useAuth(); const state = useData<Conversation[]>(() => request('/messages'), []);
  if (state.loading) return <LoadingState />;
  return <Screen refreshing={state.refreshing} onRefresh={state.reload}><Header eyebrow="Your conversations" title="Messages" subtitle="Keep plans, questions, and encouragement in one place." />{state.error ? <ErrorNotice message={state.error} /> : null}{state.data?.length ? state.data.map((item) => { const name = item.tutor_name || item.student_name || item.other_user_name || 'NextDoorLearn member'; return <Pressable key={item.connection_id} style={({ pressed }) => [styles.row, pressed && styles.pressed]} onPress={() => router.push({ pathname: '/(app)/conversation/[id]', params: { id: item.connection_id, name } })}><Avatar name={name} uri={item.avatar_url} /><View style={styles.copy}><View style={styles.top}><Text style={styles.name}>{name}</Text>{item.last_message_time ? <Text style={styles.time}>{formatTime(item.last_message_time)}</Text> : null}</View><Text style={styles.preview} numberOfLines={1}>{item.last_message || (user?.role === 'tutor' ? 'Send a welcome message to your student.' : 'Start planning with your tutor.')}</Text></View></Pressable>; }) : <EmptyState icon={MessageCircle} title="No conversations yet" message={user?.role === 'tutor' ? 'Accepted student requests will appear here.' : 'Once a tutor accepts your request, you can message them here.'} />}</Screen>;
}
const formatTime = (value: string) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); };
const styles = StyleSheet.create({ row: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.line, paddingHorizontal: spacing.sm }, pressed: { opacity: 0.65 }, copy: { flex: 1, gap: 5 }, top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }, name: { color: colors.ink, fontFamily: typography.bold, fontSize: 15 }, time: { color: colors.muted, fontFamily: typography.regular, fontSize: 11 }, preview: { color: colors.muted, fontFamily: typography.regular, fontSize: 13 } });
