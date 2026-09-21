import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Banknote, CheckCircle2, CreditCard, ExternalLink, RefreshCw, ShieldCheck, WalletCards, X } from 'lucide-react';
import AppShell, { EmptyState, ErrorState, LoadingState } from '../components/AppShell';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const money = (cents = 0) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(cents) / 100);
const paymentLabel = {
  free: 'Volunteer session', unpaid: 'Payment due', pending: 'Payment started', requires_action: 'Action needed',
  processing: 'Processing', succeeded: 'Paid', refunded: 'Refunded', refund_pending: 'Refund pending',
  refund_failed: 'Refund needs support', failed: 'Payment failed', cancelled: 'Cancelled'
};

const PaymentForm = ({ onClose, onComplete }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true); setError('');
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/payments?payment=return` },
      redirect: 'if_required'
    });
    if (result.error) {
      setError(result.error.message || 'Payment could not be completed.');
      setBusy(false);
      return;
    }
    onComplete(result.paymentIntent?.status || 'processing');
  };

  return <form onSubmit={submit} className="payment-form">
    <PaymentElement options={{ layout: 'tabs' }} />
    {error ? <div className="alert alert-error">{error}</div> : null}
    <div className="button-row">
      <button className="btn btn-primary" type="submit" disabled={!stripe || busy}><ShieldCheck size={17} />{busy ? 'Confirming...' : 'Pay securely'}</button>
      <button className="btn btn-ghost" type="button" onClick={onClose} disabled={busy}>Cancel</button>
    </div>
  </form>;
};

const CheckoutModal = ({ checkout, onClose, onComplete }) => {
  const stripePromise = useMemo(() => loadStripe(checkout.publishableKey), [checkout.publishableKey]);
  const options = useMemo(() => ({
    clientSecret: checkout.clientSecret,
    appearance: {
      theme: 'stripe',
      variables: { colorPrimary: '#087f73', colorText: '#17201d', colorDanger: '#c94332', borderRadius: '6px', fontFamily: 'Inter, system-ui, sans-serif' }
    }
  }), [checkout.clientSecret]);
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="payment-title">
    <div className="modal payment-modal">
      <div className="modal-head">
        <div><span className="eyebrow">Secure checkout</span><h2 id="payment-title">Pay {money(checkout.amountCents)}</h2><p className="muted">Payment stays inside NextDoorLearn and is routed to your tutor through Stripe.</p></div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close payment"><X size={18} /></button>
      </div>
      <Elements stripe={stripePromise} options={options}><PaymentForm onClose={onClose} onComplete={onComplete} /></Elements>
      <p className="payment-security"><ShieldCheck size={15} /> Card and bank details go directly to Stripe and are never stored by NextDoorLearn.</p>
    </div>
  </div>;
};

const PaymentRow = ({ item, role, onPay, paying }) => {
  const person = role === 'tutor' ? item.student_name : item.tutor_name;
  const state = item.payment_status || 'unpaid';
  return <article className="payment-row">
    <div className="payment-row-main">
      <span className="payment-row-icon">{state === 'succeeded' ? <CheckCircle2 size={20} /> : <CreditCard size={20} />}</span>
      <div><strong>{item.title || 'Tutoring session'}</strong><p>{person} · {String(item.scheduled_date || '').slice(0, 10)} · {String(item.start_time || '').slice(0, 5)}</p></div>
    </div>
    <div className="payment-row-total"><strong>{money(item.amount_cents)}</strong><span className={`badge ${state === 'succeeded' || state === 'free' ? 'badge-success' : state.includes('refund') ? 'badge-warning' : 'badge-primary'}`}>{paymentLabel[state] || state}</span></div>
    {role === 'student' && state === 'unpaid' ? <button className="btn btn-primary btn-sm" type="button" disabled={!item.can_pay || paying} onClick={() => onPay(item)}>{paying ? 'Preparing...' : item.payout_ready ? 'Pay tutor' : 'Tutor setup pending'}</button> : null}
  </article>;
};

const Payments = () => {
  const { user } = useAuth();
  const [history, setHistory] = useState([]);
  const [account, setAccount] = useState(null);
  const [earnings, setEarnings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [payingId, setPayingId] = useState(null);
  const [checkout, setCheckout] = useState(null);
  const tutor = user?.role === 'tutor';

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const token = localStorage.getItem('token');
      const [historyResponse, roleResponse] = await Promise.all([
        api.getPaymentHistory(token), tutor ? api.getPaymentAccount(token) : Promise.resolve(null)
      ]);
      if (historyResponse.error) throw new Error(historyResponse.error);
      if (roleResponse?.error) throw new Error(roleResponse.error);
      setHistory(historyResponse);
      setAccount(roleResponse);
      if (tutor) {
        const earningsResponse = await api.getTutorEarnings(token);
        if (earningsResponse.error) throw new Error(earningsResponse.error);
        setEarnings(earningsResponse);
      }
    } catch (caught) { setError(caught.message || 'Payments could not be loaded.'); }
    finally { setLoading(false); }
  }, [tutor]);

  useEffect(() => { load(); }, [load]);

  const beginOnboarding = async () => {
    setBusy(true); setError('');
    const response = await api.startPaymentOnboarding(localStorage.getItem('token'));
    if (response.url) window.location.assign(response.url);
    else { setError(response.error || 'Payout setup could not be started.'); setBusy(false); }
  };

  const beginPayment = async (item) => {
    setPayingId(item.session_id); setError('');
    const response = await api.createSessionPaymentIntent(item.session_id, localStorage.getItem('token'));
    setPayingId(null);
    if (response.error) return setError(response.error);
    setCheckout(response);
  };

  const paymentComplete = (status) => {
    setCheckout(null);
    setNotice(status === 'succeeded' ? 'Payment confirmed. Your tutor has been notified.' : 'Payment is processing. This page will update when Stripe confirms it.');
    load();
  };

  if (loading) return <AppShell><LoadingState label="Loading secure payments..." /></AppShell>;
  if (error && !history.length && !account) return <AppShell><ErrorState message={error} action={<button className="btn btn-primary" onClick={load}>Try again</button>} /></AppShell>;

  return <AppShell>
    <main className="page payments-page">
      <section className="section-head">
        <div><span className="eyebrow"><WalletCards size={15} />{tutor ? 'Tutor earnings' : 'Session payments'}</span><h1 className="page-title">{tutor ? 'Get paid without chasing invoices.' : 'Pay your tutor without leaving NextDoorLearn.'}</h1><p className="page-copy">{tutor ? 'Set up verified payouts, track paid sessions, and keep tutoring rates transparent.' : 'Review the exact session total and pay through a secure embedded checkout.'}</p></div>
        <button className="btn btn-ghost" type="button" onClick={load}><RefreshCw size={17} />Refresh</button>
      </section>
      {error ? <div className="alert alert-error">{error}</div> : null}
      {notice ? <div className="alert"><CheckCircle2 size={18} />{notice}</div> : null}

      {tutor ? <>
        <section className="payments-summary-grid">
          <div className="card card-pad"><span className="stat-icon"><Banknote size={21} /></span><strong className="payment-total">{money((earnings?.totals?.paid_cents || 0) - (earnings?.totals?.refunded_cents || 0))}</strong><p className="muted">Net session earnings recorded</p></div>
          <div className="card card-pad"><span className="stat-icon"><CheckCircle2 size={21} /></span><strong className="payment-total">{earnings?.totals?.paid_sessions || 0}</strong><p className="muted">Paid tutoring sessions</p></div>
          <div className="card card-pad payout-card"><div><span className="eyebrow">Payout status</span><h2>{account?.onboardingStatus === 'active' ? 'Ready to receive payments' : account?.onboardingStatus === 'restricted' ? 'More information needed' : 'Connect your payout account'}</h2><p>{account?.configured ? 'Stripe verifies identity and sends earnings to your connected bank account.' : 'The payment code is ready. Stripe keys still need to be added to the production backend.'}</p></div><button className="btn btn-primary" type="button" onClick={beginOnboarding} disabled={busy || !account?.configured}>{account?.onboardingStatus === 'active' ? 'Review payout details' : 'Set up payouts'}<ExternalLink size={16} /></button></div>
        </section>
      </> : <div className="payment-trust-band"><ShieldCheck size={22} /><div><strong>Protected payment details</strong><p>NextDoorLearn calculates totals from the booked rate. Stripe securely handles payment details and sends funds to the tutor&apos;s verified payout account.</p></div></div>}

      <section className="card card-pad payment-history">
        <div className="section-head compact"><div><h2>{tutor ? 'Earnings activity' : 'Your sessions'}</h2><p>{tutor ? 'Paid, refunded, and pending session payments.' : 'Free and paid sessions stay together in one clear history.'}</p></div></div>
        {history.length ? <div className="payment-list">{history.map((item) => <PaymentRow key={item.session_id} item={item} role={user.role} onPay={beginPayment} paying={payingId === item.session_id} />)}</div> : <EmptyState icon={CreditCard} title="No session payments yet">Payment details will appear when a tutoring session is scheduled.</EmptyState>}
      </section>
    </main>
    {checkout ? <CheckoutModal checkout={checkout} onClose={() => setCheckout(null)} onComplete={paymentComplete} /> : null}
  </AppShell>;
};

export default Payments;
