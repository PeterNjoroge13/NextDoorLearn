const TRUTHY = new Set(['1', 'true', 'yes', 'on']);

const FEATURE_CONFIG = {
  bookings: {
    env: 'DISABLE_NEW_BOOKINGS',
    message: 'New bookings are temporarily paused while we complete maintenance. Existing sessions are still available.'
  },
  payments: {
    env: 'DISABLE_PAYMENTS',
    message: 'New payments and payout setup are temporarily paused. Existing payment records remain available.'
  },
  zoom: {
    env: 'DISABLE_ZOOM',
    message: 'New Zoom rooms are temporarily unavailable. You can retry when maintenance is complete.'
  },
  googleCalendar: {
    env: 'DISABLE_GOOGLE_CALENDAR',
    message: 'Google Calendar connection and sync are temporarily paused.'
  },
  email: {
    env: 'DISABLE_EMAIL',
    message: 'Email delivery is temporarily paused. Messages will remain queued for delivery.'
  }
};

const isFeatureDisabled = (feature) => {
  const config = FEATURE_CONFIG[feature];
  return config ? TRUTHY.has(String(process.env[config.env] || '').trim().toLowerCase()) : false;
};

const featureStates = () => Object.fromEntries(
  Object.keys(FEATURE_CONFIG).map((feature) => [feature, isFeatureDisabled(feature) ? 'maintenance' : 'available'])
);

const featureUnavailablePayload = (feature) => ({
  error: FEATURE_CONFIG[feature]?.message || 'This feature is temporarily unavailable.',
  code: 'FEATURE_MAINTENANCE',
  feature
});

const requireFeature = (feature) => (req, res, next) => {
  if (isFeatureDisabled(feature)) return res.status(503).json(featureUnavailablePayload(feature));
  next();
};

module.exports = { featureStates, featureUnavailablePayload, isFeatureDisabled, requireFeature };
