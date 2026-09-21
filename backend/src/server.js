const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { randomUUID } = require('crypto');
require('dotenv').config();
const db = require('./db/database');
const { providerConfigured } = require('./services/email');
const { zoomConfigured } = require('./services/zoom');
const { hasGoogleConfig } = require('./services/googleCalendar');
const { publicPaymentConfig } = require('./services/payments');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const connectionRoutes = require('./routes/connections');
const messageRoutes = require('./routes/messages');
const uploadRoutes = require('./routes/upload');
const statusRoutes = require('./routes/status');
const requestRoutes = require('./routes/requests');
const sessionRoutes = require('./routes/sessions');
const reviewRoutes = require('./routes/reviews');
const notificationRoutes = require('./routes/notifications');
const availabilityRoutes = require('./routes/availability');
const googleRoutes = require('./routes/google');
const reportRoutes = require('./routes/reports');
const adminRoutes = require('./routes/admin');
const favoriteRoutes = require('./routes/favorites');
const communityRoutes = require('./routes/community');
const progressRoutes = require('./routes/progress');
const blockRoutes = require('./routes/blocks');
const recommendationRoutes = require('./routes/recommendations');
const jobRoutes = require('./routes/jobs');
const resendWebhookRoutes = require('./routes/resendWebhook');
const deviceRoutes = require('./routes/devices');
const mediaRoutes = require('./routes/media');
const paymentRoutes = require('./routes/payments');

const app = express();
const PORT = process.env.PORT || 3001;
const uploadRoot = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');

const validateProductionConfig = () => {
  if (process.env.NODE_ENV !== 'production') return;
  const missing = [];
  if (!process.env.JWT_SECRET) missing.push('JWT_SECRET');
  if (!process.env.FIELD_ENCRYPTION_KEY) missing.push('FIELD_ENCRYPTION_KEY');
  if (!process.env.JOB_SECRET) missing.push('JOB_SECRET');
  if (!process.env.DATABASE_URL) missing.push('DATABASE_URL');
  if (!process.env.FRONTEND_URL) missing.push('FRONTEND_URL');
  if (!process.env.CORS_ORIGINS) missing.push('CORS_ORIGINS');
  if (process.env.REQUIRE_EMAIL_VERIFICATION === 'true' && !providerConfigured()) {
    missing.push('RESEND_API_KEY and EMAIL_FROM (required when email verification is enabled)');
  }
  if (missing.length) throw new Error(`Missing production configuration: ${missing.join(', ')}`);
};

// Middleware
app.set('trust proxy', 1);
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use((req, res, next) => {
  req.requestId = randomUUID();
  res.setHeader('X-Request-ID', req.requestId);
  next();
});

const configuredOrigins = [
  process.env.FRONTEND_URL,
  ...(process.env.CORS_ORIGINS || '').split(',')
]
  .map((origin) => origin && origin.trim())
  .filter(Boolean);

const defaultDevOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

const allowedOrigins = new Set(
  process.env.NODE_ENV === 'production'
    ? configuredOrigins
    : [...configuredOrigins, ...defaultDevOrigins]
);

const defaultDevelopmentOriginPatterns = [
  /^http:\/\/(localhost|127\.0\.0\.1):\d+$/i
];

const configuredOriginPatterns = (process.env.CORS_ORIGIN_PATTERNS || '')
  .split(',')
  .map((pattern) => pattern.trim())
  .filter(Boolean)
  .map((pattern) => {
    try {
      return new RegExp(pattern);
    } catch {
      console.warn(`Ignoring invalid CORS origin pattern: ${pattern}`);
      return null;
    }
  })
  .filter(Boolean);

const allowedOriginPatterns = process.env.NODE_ENV === 'production'
  ? configuredOriginPatterns
  : [...defaultDevelopmentOriginPatterns, ...configuredOriginPatterns];

const isAllowedOrigin = (origin) =>
  allowedOrigins.has(origin) || allowedOriginPatterns.some((pattern) => pattern.test(origin));

app.use(cors({
  origin(origin, callback) {
    if (!origin || isAllowedOrigin(origin)) {
      return callback(null, true);
    }
    const error = new Error('Origin not allowed');
    error.statusCode = 403;
    return callback(error);
  },
  credentials: true
}));
app.use('/api/webhooks/resend', resendWebhookRoutes);
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json', limit: '1mb' }), paymentRoutes.handleWebhook);
app.use(express.json({ limit: '1mb' }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_MAX || 300),
  standardHeaders: 'draft-7',
  legacyHeaders: false
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT_MAX || 30),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again later.' }
});

const publicFormLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: Number(process.env.PUBLIC_FORM_RATE_LIMIT_MAX || 15),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many submissions. Please try again later.' }
});

const messageWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.MESSAGE_RATE_LIMIT_MAX || 30),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many messages sent. Please wait a moment.' }
});

const safetyActionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: Number(process.env.SAFETY_ACTION_RATE_LIMIT_MAX || 10),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many safety requests. Please try again later or contact support.' }
});

// Immutable profile media is public and cached; do not spend authenticated API quota on image rendering.
app.use('/api/media', mediaRoutes);

app.use('/api', apiLimiter);
app.use('/api/community/tutor-applications', publicFormLimiter);
app.use('/api/community/sponsor-inquiries', publicFormLimiter);
app.use('/api/messages/send', messageWriteLimiter);
app.use('/api/reports', safetyActionLimiter);
app.use('/api/blocks', safetyActionLimiter);

// Serve static files from uploads directory
app.use('/uploads', express.static(uploadRoot, {
  dotfiles: 'deny',
  index: false,
  maxAge: '1y',
  immutable: true,
  setHeaders(response) {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'");
  }
}));

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/connections', connectionRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/google', googleRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/blocks', blockRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/payments', paymentRoutes);

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await db.prepare('SELECT 1 as ok').get();
    res.json({
      status: 'ok',
      message: 'NextDoorLearn API is running',
      database: 'ok',
      email: providerConfigured() ? 'configured' : 'not_configured',
      emailVerification: process.env.REQUIRE_EMAIL_VERIFICATION === 'true' ? 'required' : 'optional',
      zoom: zoomConfigured() ? 'configured' : 'not_configured',
      googleCalendar: hasGoogleConfig() ? 'configured' : 'not_configured',
      mediaStorage: 'database',
      payments: publicPaymentConfig().configured ? 'configured' : 'not_configured',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      message: 'NextDoorLearn API is reachable, but the database check failed',
      database: 'error'
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  const statusCode = Number(err.statusCode) || 500;
  if (statusCode >= 500) console.error(`[${req.requestId}]`, err.stack);
  res.status(statusCode).json({
    error: statusCode === 403 ? 'Origin not allowed' : 'Something went wrong!',
    requestId: req.requestId
  });
});

const startServer = async () => {
  try {
    validateProductionConfig();
    await db.initialize();
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT} with ${db.dialect}`);
    });
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  }
};

startServer();
