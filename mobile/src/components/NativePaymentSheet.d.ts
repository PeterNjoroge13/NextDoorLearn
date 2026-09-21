import type { ComponentType } from 'react';

type NativePaymentSheetProps = {
  checkout: { clientSecret: string; publishableKey: string; amountCents: number };
  onDone: () => void;
  onError: (message: string) => void;
};

declare const NativePaymentSheet: ComponentType<NativePaymentSheetProps>;
export default NativePaymentSheet;
