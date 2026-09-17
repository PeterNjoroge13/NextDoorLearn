import { router } from 'expo-router';
import { ArrowLeft, Bell, CheckCheck } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { EmptyState, ErrorNotice, Header, LoadingState, Screen } from '@/components/ui';
import { request } from '@/lib/api';
import { useData } from '@/lib/hooks';
import { colors, spacing, typography } from '@/theme';

export default function NotificationsScreen() {
  const state = useData<any>(() => request('/notifications?limit=60'), []); if (state.loading) return <LoadingState />; const items = state.data?.notifications || [];
  const read = async (id: number) => { await request(`/notifications/${id}/read`, { method: 'PATCH' }); state.reload(); };
  const readAll = async () => { await request('/notifications/read-all', { method: 'PATCH' }); state.reload(); };
  return <Screen refreshing={state.refreshing} onRefresh={state.reload}><Pressable onPress={() => router.back()} style={s.back}><ArrowLeft size={22} color={colors.ink} /></Pressable><Header eyebrow={`${state.data?.unreadCount || 0} unread`} title="Notifications" subtitle="Messages, session reminders, requests, and platform updates." action={items.length ? <Pressable onPress={readAll} style={s.readAll}><CheckCheck size={20} color={colors.brand} /></Pressable> : null} />{state.error ? <ErrorNotice message={state.error} /> : null}{items.length ? items.map((item: any) => <Pressable key={item.id} onPress={() => read(item.id)} style={[s.item, !item.is_read && s.unread]}><View style={[s.icon, !item.is_read && s.iconUnread]}><Bell size={18} color={colors.brand} /></View><View style={s.copy}><Text style={s.title}>{item.title}</Text><Text style={s.body}>{item.message}</Text><Text style={s.time}>{formatDate(item.created_at)}</Text></View>{!item.is_read ? <View style={s.dot} /> : null}</Pressable>) : <EmptyState icon={Bell} title="You’re all caught up" message="New messages, requests, and reminders will appear here." />}</Screen>;
}
const formatDate = (value: string) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); };
const s = StyleSheet.create({ back: { height: 44, justifyContent: 'center' }, readAll: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }, item: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, padding: spacing.md, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface }, unread: { borderColor: '#B9DDD6', backgroundColor: colors.surfaceTint }, icon: { width: 38, height: 38, borderRadius: 8, backgroundColor: '#EEEAE3', alignItems: 'center', justifyContent: 'center' }, iconUnread: { backgroundColor: colors.brandSoft }, copy: { flex: 1, gap: 4 }, title: { color: colors.ink, fontFamily: typography.bold, fontSize: 14 }, body: { color: colors.muted, fontFamily: typography.regular, fontSize: 13, lineHeight: 18 }, time: { color: colors.muted, fontSize: 10 }, dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.coral, marginTop: 5 } });
