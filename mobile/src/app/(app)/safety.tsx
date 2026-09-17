import { router } from 'expo-router';
import { ArrowLeft, ShieldCheck } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar, Button, Card, EmptyState, ErrorNotice, Header, LoadingState, Screen } from '@/components/ui';
import { request } from '@/lib/api';
import { useData } from '@/lib/hooks';
import { colors, spacing, typography } from '@/theme';

export default function SafetyScreen() {
  const state = useData<any[]>(() => request('/blocks'), []); if (state.loading) return <LoadingState />;
  const unblock = async (id: number) => { await request(`/blocks/${id}`, { method: 'DELETE' }); state.reload(); };
  return <Screen refreshing={state.refreshing} onRefresh={state.reload}><Pressable onPress={() => router.back()} style={s.back}><ArrowLeft size={22} color={colors.ink} /></Pressable><Header eyebrow="Privacy and moderation" title="Safety center" subtitle="Manage blocked accounts. You can report someone from their profile." />{state.error ? <ErrorNotice message={state.error} /> : null}<Card tone="brand"><Text style={s.cardTitle}>Your safety comes first</Text><Text style={s.cardCopy}>Blocking prevents matching and communication. Reports are sent privately to the moderation team for review.</Text></Card>{state.data?.length ? state.data.map((item: any) => <Card key={item.id} style={s.person}><Avatar name={item.name} uri={item.avatar_url} /><View style={s.personCopy}><Text style={s.name}>{item.name}</Text><Text style={s.role}>{item.role} · Blocked</Text></View><Button label="Unblock" variant="secondary" onPress={() => unblock(item.blocked_user_id)} /></Card>) : <EmptyState icon={ShieldCheck} title="No blocked accounts" message="People you block will be listed here so you can reverse the decision later." />}</Screen>;
}
const s = StyleSheet.create({ back: { height: 44, justifyContent: 'center' }, cardTitle: { color: colors.brandStrong, fontFamily: typography.bold, fontSize: 16 }, cardCopy: { color: colors.muted, fontFamily: typography.regular, lineHeight: 21 }, person: { flexDirection: 'row', alignItems: 'center' }, personCopy: { flex: 1 }, name: { color: colors.ink, fontFamily: typography.bold }, role: { color: colors.muted, fontSize: 12, textTransform: 'capitalize' } });
