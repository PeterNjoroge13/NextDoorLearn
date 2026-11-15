import React, { useEffect, useState } from 'react';
import { loadConnectAndInitialize } from '@stripe/connect-js';
import {
  ConnectAccountOnboarding,
  ConnectComponentsProvider,
  ConnectNotificationBanner
} from '@stripe/react-connect-js';
import api from '../services/api';

const appearance = {
  overlays: 'dialog',
  variables: { fontFamily: 'inherit', colorPrimary: '#1f6feb', borderRadius: '10px' }
};

// Embedded Stripe Connect components for tutors: the notification banner keeps payout
// accounts healthy as requirements change, and onboarding runs inside NextDoorLearn.
const TutorPayoutSetup = ({ publishableKey, showOnboarding, onExit, onError }) => {
  const [connectInstance, setConnectInstance] = useState(null);

  useEffect(() => {
    if (!publishableKey) return undefined;
    let cancelled = false;
    const instance = loadConnectAndInitialize({
      publishableKey,
      appearance,
      fetchClientSecret: async () => {
        const response = await api.createPayoutAccountSession(localStorage.getItem('token'));
        if (!response.clientSecret) {
          const message = response.error || 'Payout setup could not be loaded.';
          onError?.(message);
          throw new Error(message);
        }
        return response.clientSecret;
      }
    });
    if (!cancelled) setConnectInstance(instance);
    return () => { cancelled = true; };
  }, [publishableKey, onError]);

  if (!connectInstance) return null;

  return <ConnectComponentsProvider connectInstance={connectInstance}>
    <div className="payout-notification-banner"><ConnectNotificationBanner /></div>
    {showOnboarding ? <div className="card card-pad payout-onboarding">
      <ConnectAccountOnboarding
        onExit={onExit}
        collectionOptions={{ fields: 'eventually_due' }}
        onLoadError={() => onError?.('Payout setup could not be loaded. Please try again.')}
      />
    </div> : null}
  </ConnectComponentsProvider>;
};

export default TutorPayoutSetup;
