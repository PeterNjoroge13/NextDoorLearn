import { StripeProvider, useStripe } from '@stripe/stripe-react-native';
import { useEffect } from 'react';
import { colors } from '@/theme';

type Checkout = { clientSecret: string; publishableKey: string; amountCents: number };
type Props = { checkout: Checkout; onDone: () => void; onError: (message: string) => void };

function PaymentSheetRunner({ checkout, onDone, onError }: Props) {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  useEffect(() => {
    let active = true;
    (async () => {
      const initialized = await initPaymentSheet({
        merchantDisplayName: 'NextDoorLearn',
        paymentIntentClientSecret: checkout.clientSecret,
        returnURL: 'nextdoorlearn://payments',
        appearance: { colors: { primary: colors.brand, background: colors.surface, componentBackground: colors.surface, primaryText: colors.ink, secondaryText: colors.muted } },
      });
      if (!active) return;
      if (initialized.error) return onError(initialized.error.message);
      const result = await presentPaymentSheet();
      if (!active) return;
      if (result.error?.code === 'Canceled') return onError('');
      if (result.error) return onError(result.error.message);
      onDone();
    })().catch((error) => active && onError(error instanceof Error ? error.message : 'Payment could not be opened.'));
    return () => { active = false; };
  }, [checkout.clientSecret, initPaymentSheet, onDone, onError, presentPaymentSheet]);
  return null;
}

export default function NativePaymentSheet(props: Props) {
  return <StripeProvider publishableKey={props.checkout.publishableKey} urlScheme="nextdoorlearn"><PaymentSheetRunner {...props} /></StripeProvider>;
}
