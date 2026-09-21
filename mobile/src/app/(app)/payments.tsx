import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import { ArrowLeft, Banknote, CheckCircle2, CreditCard, RefreshCw, ShieldCheck, WalletCards } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Chip, EmptyState, ErrorNotice, Header, LoadingState, Screen } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { request } from '@/lib/api';
import { useData } from '@/lib/hooks';
import { colors, spacing, typography } from '@/theme';
import NativePaymentSheet from '@/components/NativePaymentSheet';

type PaymentItem = {
  session_id: number; title: string; scheduled_date: string; start_time: string;
  amount_cents: number; payment_status: string; payout_ready: boolean; can_pay: boolean;
  student_name: string; tutor_name: string;
};
type PaymentAccount = { configured: boolean; onboardingStatus: string; payoutsEnabled: boolean; requirementsDue: string[] };
type Checkout = { clientSecret: string; publishableKey: string; amountCents: number };

const labels: Record<string, string> = {
  free: 'Volunteer session', unpaid: 'Payment due', pending: 'Started', requires_action: 'Action needed',
  processing: 'Processing', succeeded: 'Paid', refunded: 'Refunded', refund_pending: 'Refund pending',
  refund_failed: 'Support needed', failed: 'Failed', cancelled: 'Cancelled',
};
const money = (cents = 0) => `$${(Number(cents) / 100).toFixed(2)}`;

export default function PaymentsScreen() {
  const { user } = useAuth();
  const tutor = user?.role === 'tutor';
  const history = useData<PaymentItem[]>(() => request('/payments/history'), []);
  const account = useData<PaymentAccount>(() => tutor ? request('/payments/account') : Promise.resolve({ configured: false, onboardingStatus: 'not_started', payoutsEnabled: false, requirementsDue: [] }), [tutor]);
  const earnings = useData<any>(() => tutor ? request('/payments/earnings') : Promise.resolve(null), [tutor]);
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [onboarding, setOnboarding] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const reload = () => { history.reload(); if (tutor) { account.reload(); earnings.reload(); } };
  const pay = async (item: PaymentItem) => {
    setBusyId(item.session_id); setError(''); setNotice('');
    try {
      const response = await request<Checkout>(`/payments/sessions/${item.session_id}/intent`, { method: 'POST' });
      setCheckout(response);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Payment could not be prepared.'); }
    finally { setBusyId(null); }
  };
  const beginOnboarding = async () => {
    setOnboarding(true); setError('');
    try {
      const response = await request<{ url: string }>('/payments/account/onboarding-link', { method: 'POST' });
      await WebBrowser.openBrowserAsync(response.url);
      setNotice('Refresh after completing Stripe payout setup.'); reload();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Payout setup could not be opened.'); }
    finally { setOnboarding(false); }
  };
  const paid = Number(earnings.data?.totals?.paid_cents || 0) - Number(earnings.data?.totals?.refunded_cents || 0);

  if (history.loading || (tutor && (account.loading || earnings.loading))) return <LoadingState />;
  return <Screen refreshing={history.refreshing || account.refreshing || earnings.refreshing} onRefresh={reload}>
    <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.back}><ArrowLeft size={22} color={colors.ink} /></Pressable>
    <Header eyebrow={tutor ? 'Tutor earnings' : 'Session payments'} title={tutor ? 'Get paid without chasing invoices.' : 'Pay your tutor inside NextDoorLearn.'} subtitle={tutor ? 'Connect secure payouts and keep every session payment organized.' : 'Review the exact total, then use Stripe PaymentSheet without leaving the app.'} action={<Pressable accessibilityRole="button" accessibilityLabel="Refresh payments" onPress={reload} style={styles.refresh}><RefreshCw size={19} color={colors.brand} /></Pressable>} />
    {error || history.error || account.error || earnings.error ? <ErrorNotice message={error || history.error || account.error || earnings.error || ''} /> : null}
    {notice ? <Card tone="brand"><Text style={styles.notice}>{notice}</Text></Card> : null}

    {tutor ? <>
      <View style={styles.summary}>
        <Card style={styles.summaryCard}><Banknote size={22} color={colors.brand} /><Text style={styles.total}>{money(paid)}</Text><Text style={styles.muted}>Net recorded earnings</Text></Card>
        <Card style={styles.summaryCard}><CheckCircle2 size={22} color={colors.green} /><Text style={styles.total}>{earnings.data?.totals?.paid_sessions || 0}</Text><Text style={styles.muted}>Paid sessions</Text></Card>
      </View>
      <Card tone={account.data?.payoutsEnabled ? 'brand' : 'gold'}>
        <Text style={styles.section}>{account.data?.payoutsEnabled ? 'Payouts ready' : 'Connect your payout account'}</Text>
        <Text style={styles.copy}>{account.data?.configured ? 'Stripe verifies your identity and sends tutoring earnings to your connected bank account.' : 'The app is ready for payments, but Stripe production keys have not been added yet.'}</Text>
        <Button label={account.data?.payoutsEnabled ? 'Review payout details' : 'Set up secure payouts'} onPress={beginOnboarding} loading={onboarding} disabled={!account.data?.configured} />
      </Card>
    </> : <Card tone="brand"><View style={styles.trust}><ShieldCheck size={24} color={colors.brand} /><View style={styles.flex}><Text style={styles.section}>Protected payment details</Text><Text style={styles.copy}>Stripe securely handles card and bank details. NextDoorLearn never stores them.</Text></View></View></Card>}

    <View style={styles.heading}><WalletCards size={21} color={colors.brand} /><Text style={styles.section}>{tutor ? 'Earnings activity' : 'Your sessions'}</Text></View>
    {history.data?.length ? history.data.map((item) => <Card key={item.session_id}>
      <View style={styles.row}><View style={styles.icon}><CreditCard size={20} color={colors.brand} /></View><View style={styles.flex}><Text style={styles.itemTitle}>{item.title || 'Tutoring session'}</Text><Text style={styles.muted}>{tutor ? item.student_name : item.tutor_name} · {String(item.scheduled_date).slice(0, 10)} at {String(item.start_time).slice(0, 5)}</Text></View><Text style={styles.amount}>{money(item.amount_cents)}</Text></View>
      <Chip label={labels[item.payment_status] || item.payment_status} tone={item.payment_status === 'succeeded' || item.payment_status === 'free' ? 'brand' : item.payment_status.includes('refund') ? 'gold' : 'neutral'} />
      {!tutor && item.payment_status === 'unpaid' ? <Button label={item.payout_ready ? 'Pay tutor securely' : 'Tutor payout setup pending'} onPress={() => pay(item)} loading={busyId === item.session_id} disabled={!item.can_pay} /> : null}
    </Card>) : <EmptyState icon={CreditCard} title="No session payments yet" message="Payment details will appear after a tutoring session is scheduled." />}

    {checkout?.publishableKey ? <NativePaymentSheet checkout={checkout} onDone={() => { setCheckout(null); setNotice('Payment submitted. Pull to refresh for confirmation.'); reload(); }} onError={(message) => { setCheckout(null); if (message) setError(message); }} /> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, justifyContent: 'center' },
  refresh: { width: 44, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandSoft },
  summary: { flexDirection: 'row', gap: spacing.md }, summaryCard: { flex: 1 }, total: { color: colors.ink, fontFamily: typography.bold, fontSize: 24 },
  muted: { color: colors.muted, fontFamily: typography.regular, fontSize: 12, lineHeight: 18 }, section: { color: colors.ink, fontFamily: typography.bold, fontSize: 17 },
  copy: { color: colors.muted, fontFamily: typography.regular, lineHeight: 21 }, notice: { color: colors.brandStrong, fontFamily: typography.medium },
  trust: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }, flex: { flex: 1 }, heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md }, icon: { width: 42, height: 42, borderRadius: 8, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  itemTitle: { color: colors.ink, fontFamily: typography.bold, fontSize: 15 }, amount: { color: colors.ink, fontFamily: typography.bold, fontSize: 16 },
});
