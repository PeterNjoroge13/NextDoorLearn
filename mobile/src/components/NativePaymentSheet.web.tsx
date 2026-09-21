import { useEffect } from 'react';

type Props = { onError: (message: string) => void };

export default function NativePaymentSheet({ onError }: Props) {
  useEffect(() => {
    onError('Native checkout is available in the iOS and Android app. Use the NextDoorLearn website to pay from this browser.');
  }, [onError]);
  return null;
}
