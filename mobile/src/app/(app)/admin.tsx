import { router } from 'expo-router';
import { ArrowLeft, ClipboardCheck, Flag, GraduationCap, RotateCcw, Users, WalletCards } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stat } from '@/components/DashboardBits';
import { Button, Card, Chip, ErrorNotice, Header, LoadingState, Screen } from '@/components/ui';
import { request } from '@/lib/api';
import { useData } from '@/lib/hooks';
import { colors, spacing, typography } from '@/theme';

const tabs = ['Overview', 'Applications', 'Reports', 'Waitlist', 'Payments'];
const money = (amount = 0) => `$${(Number(amount) / 100).toFixed(2)}`;
export default function AdminScreen() {
  const [tab, setTab] = useState('Overview');
  const [refundDrafts, setRefundDrafts] = useState<Record<number, { reason?: string; confirmation?: string }>>({});
  const [refundBusy, setRefundBusy] = useState<number | null>(null);
  const [actionError, setActionError] = useState('');
  const state = useData<any>(async () => {
    const [overview, applications, reports, waitlist, payments] = await Promise.all([
      request('/admin/overview'), request('/admin/tutor-applications'), request('/admin/reports'),
      request('/admin/waitlist'), request('/admin/payments'),
    ]);
    return { overview, applications, reports, waitlist, payments };
  }, []);
  if (state.loading) return <LoadingState />; const data = state.data || {};
  const applicationAction = async (id: number, status: string) => { await request(`/admin/tutor-applications/${id}`, { method: 'PATCH', body: JSON.stringify({ status, reason: status === 'approved' ? 'Approved from mobile administration' : 'Application does not currently meet platform requirements' }) }); state.reload(); };
  const reportAction = async (id: number, status: string) => { await request(`/admin/reports/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }); state.reload(); };
  const refundPayment = async (payment: any) => {
    const draft = refundDrafts[payment.id] || {};
    if ((draft.reason || '').trim().length < 8 || draft.confirmation !== 'REFUND') {
      setActionError('Add a clear reason and type REFUND exactly before continuing.');
      return;
    }
    setRefundBusy(payment.id); setActionError('');
    try {
      await request(`/admin/payments/${payment.id}/refund`, { method: 'POST', body: JSON.stringify(draft) });
      setRefundDrafts((current) => ({ ...current, [payment.id]: {} }));
      await state.reload();
    } catch (error: any) {
      setActionError(error?.message || 'The refund could not be completed.');
    } finally {
      setRefundBusy(null);
    }
  };
  return <Screen refreshing={state.refreshing} onRefresh={state.reload}><Pressable onPress={() => router.back()} style={s.back}><ArrowLeft size={22} color={colors.ink} /></Pressable><Header eyebrow="Owner workspace" title="Administration" subtitle="Review platform health and the queues that need a human decision." />{state.error ? <ErrorNotice message={state.error} /> : null}{actionError ? <ErrorNotice message={actionError} /> : null}<View style={s.tabs}>{tabs.map((item) => <Pressable key={item} onPress={() => setTab(item)} style={[s.tab, tab === item && s.tabActive]}><Text style={[s.tabText, tab === item && s.tabTextActive]}>{item}</Text></Pressable>)}</View>{tab === 'Overview' ? <><View style={s.stats}><Stat icon={Users} value={data.overview?.users?.total || 0} label="Users" /><Stat icon={GraduationCap} value={data.overview?.applications?.awaiting_review || 0} label="Applications waiting" tone="gold" /><Stat icon={Flag} value={data.overview?.reports?.open || 0} label="Open reports" tone="coral" /><Stat icon={ClipboardCheck} value={data.overview?.waitlist?.open || 0} label="Students waiting" tone="blue" /></View><Card tone="brand"><Text style={s.title}>Operational snapshot</Text><Text style={s.copy}>{data.overview?.sessions?.scheduled || 0} scheduled sessions · {data.overview?.emails?.pending || 0} queued emails · {data.overview?.users?.restricted || 0} restricted accounts</Text></Card></> : null}{tab === 'Applications' ? (data.applications || []).map((item: any) => <Card key={item.id}><View style={s.top}><View style={s.flex}><Text style={s.title}>{item.name}</Text><Text style={s.copy}>{item.email} · {parseList(item.subjects).join(', ')}</Text></View><Chip label={item.review_state || item.status} tone="gold" /></View><Text style={s.copy}>{item.motivation}</Text>{['submitted', 'reviewing'].includes(item.review_state) ? <View style={s.actions}><Button label="Decline" variant="secondary" onPress={() => applicationAction(item.id, 'declined')} style={s.flex} /><Button label="Approve" onPress={() => applicationAction(item.id, 'approved')} style={s.flex} /></View> : null}</Card>) : null}{tab === 'Reports' ? (data.reports || []).map((item: any) => <Card key={item.id}><View style={s.top}><View style={s.flex}><Text style={s.title}>{item.reason}</Text><Text style={s.copy}>{item.reporter_email} reported {item.reported_email}</Text></View><Chip label={item.status} tone={item.status === 'open' ? 'coral' : 'neutral'} /></View><Text style={s.copy}>{item.details || 'No additional details.'}</Text>{item.status === 'open' ? <Button label="Move to review" variant="secondary" onPress={() => reportAction(item.id, 'reviewing')} /> : null}</Card>) : null}{tab === 'Waitlist' ? (data.waitlist || []).map((item: any) => <Card key={item.id}><View style={s.top}><View style={s.flex}><Text style={s.title}>{item.name}</Text><Text style={s.copy}>{item.grade_level || 'Student'} · {parseList(item.subjects).join(', ')}</Text></View><Chip label={item.status} tone={item.status === 'open' ? 'gold' : 'brand'} /></View><Text style={s.copy}>{item.learning_goals || 'No learning goal provided.'}</Text></Card>) : null}{tab === 'Payments' ? <><View style={s.stats}><Stat icon={WalletCards} value={money(data.payments?.summary?.collected_cents)} label="Collected" /><Stat icon={RotateCcw} value={money(data.payments?.summary?.refunded_cents)} label="Refunded" tone="blue" /></View>{!data.payments?.configured ? <Card tone="gold"><Text style={s.title}>Stripe setup required</Text><Text style={s.copy}>History remains available, but refunds and new charges stay disabled until production payment keys are connected.</Text></Card> : null}{(data.payments?.payments || []).map((item: any) => { const draft = refundDrafts[item.id] || {}; const refundable = ['succeeded', 'refund_failed'].includes(item.status); return <Card key={item.id}><View style={s.top}><View style={s.flex}><Text style={s.title}>{money(item.amount_cents)} · {item.title}</Text><Text style={s.copy}>{item.student_name} paid {item.tutor_name}</Text></View><Chip label={String(item.status).replaceAll('_', ' ')} tone={item.status === 'succeeded' ? 'brand' : item.status.includes('failed') ? 'coral' : 'neutral'} /></View><Text style={s.copy}>Session #{item.session_id} · {item.scheduled_date} at {item.start_time}</Text>{refundable ? <View style={s.refund}><TextInput style={s.input} value={draft.reason || ''} onChangeText={(reason) => setRefundDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], reason } }))} placeholder="Refund reason" placeholderTextColor={colors.muted} multiline /><TextInput style={s.input} value={draft.confirmation || ''} onChangeText={(confirmation) => setRefundDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], confirmation } }))} placeholder="Type REFUND" placeholderTextColor={colors.muted} autoCapitalize="characters" /><Button label={refundBusy === item.id ? 'Refunding...' : 'Issue full refund'} variant="secondary" disabled={!data.payments?.configured || refundBusy === item.id} onPress={() => refundPayment(item)} /></View> : null}</Card>; })}</> : null}</Screen>;
}
const parseList = (value: unknown) => { if (Array.isArray(value)) return value; try { return JSON.parse(String(value || '[]')); } catch { return String(value || '').split(',').filter(Boolean); } };
const s = StyleSheet.create({ back: { height: 44, justifyContent: 'center' }, tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, tab: { paddingHorizontal: spacing.md, paddingVertical: 9, borderRadius: 8, backgroundColor: '#E9E5DD' }, tabActive: { backgroundColor: colors.ink }, tabText: { color: colors.muted, fontFamily: typography.medium, fontSize: 12 }, tabTextActive: { color: colors.white }, stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, title: { color: colors.ink, fontFamily: typography.bold, fontSize: 16 }, copy: { color: colors.muted, fontFamily: typography.regular, fontSize: 13, lineHeight: 19 }, top: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }, flex: { flex: 1 }, actions: { flexDirection: 'row', gap: spacing.sm }, refund: { gap: spacing.sm, marginTop: spacing.sm }, input: { minHeight: 44, borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: colors.ink, backgroundColor: colors.white, fontFamily: typography.regular, fontSize: 14 } });
