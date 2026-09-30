const { createPublicKey, timingSafeEqual } = require('crypto');
const jwt = require('jsonwebtoken');

const GITHUB_ISSUER = 'https://token.actions.githubusercontent.com';
const GITHUB_JWKS_URL = `${GITHUB_ISSUER}/.well-known/jwks`;
const JOB_AUDIENCE = 'nextdoorlearn-background-jobs';
const JWKS_CACHE_MS = 60 * 60 * 1000;

let jwksCache = { expiresAt: 0, keys: [] };

const safeEqual = (left, right) => {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};

const loadGitHubKeys = async () => {
  if (jwksCache.expiresAt > Date.now() && jwksCache.keys.length) return jwksCache.keys;
  const response = await fetch(GITHUB_JWKS_URL, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error('GitHub identity keys are unavailable');
  const payload = await response.json();
  if (!Array.isArray(payload.keys) || !payload.keys.length) throw new Error('GitHub identity keys are invalid');
  jwksCache = { keys: payload.keys, expiresAt: Date.now() + JWKS_CACHE_MS };
  return jwksCache.keys;
};

const validateGitHubActionsClaims = (claims) => {
  const repository = process.env.GITHUB_ACTIONS_JOB_REPOSITORY;
  const ref = process.env.GITHUB_ACTIONS_JOB_REF || 'refs/heads/main';
  const workflow = process.env.GITHUB_ACTIONS_JOB_WORKFLOW || '.github/workflows/reminders.yml';
  if (!repository) throw new Error('GitHub Actions job identity is not configured');
  if (String(claims.repository || '').toLowerCase() !== repository.toLowerCase()) {
    throw new Error('GitHub Actions repository is not authorized');
  }
  if (claims.ref !== ref || claims.ref_type !== 'branch') {
    throw new Error('GitHub Actions ref is not authorized');
  }
  if (claims.workflow_ref !== `${repository}/${workflow}@${ref}`) {
    throw new Error('GitHub Actions workflow is not authorized');
  }
  if (!['schedule', 'workflow_dispatch'].includes(claims.event_name)) {
    throw new Error('GitHub Actions event is not authorized');
  }
  if (claims.runner_environment !== 'github-hosted') {
    throw new Error('GitHub Actions runner is not authorized');
  }
  return claims;
};

const verifyGitHubActionsToken = async (token, keyLoader = loadGitHubKeys) => {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || decoded.header.alg !== 'RS256' || !decoded.header.kid) {
    throw new Error('GitHub Actions token header is invalid');
  }
  const keys = await keyLoader();
  const jwk = keys.find((key) => key.kid === decoded.header.kid && key.kty === 'RSA');
  if (!jwk) throw new Error('GitHub Actions signing key is unknown');
  const claims = jwt.verify(token, createPublicKey({ key: jwk, format: 'jwk' }), {
    algorithms: ['RS256'],
    audience: JOB_AUDIENCE,
    issuer: GITHUB_ISSUER,
    clockTolerance: 5,
    maxAge: '10m'
  });
  return validateGitHubActionsClaims(claims);
};

const authenticateBackgroundJob = async (req) => {
  const configuredSecret = process.env.JOB_SECRET;
  const configuredRepository = process.env.GITHUB_ACTIONS_JOB_REPOSITORY;
  if (!configuredSecret && !configuredRepository) {
    return process.env.NODE_ENV !== 'production' ? { method: 'development' } : null;
  }
  if (configuredSecret && safeEqual(req.headers['x-job-secret'], configuredSecret)) {
    return { method: 'shared_secret' };
  }
  const authorization = String(req.headers.authorization || '');
  if (!authorization.startsWith('Bearer ') || authorization.length > 20000) return null;
  try {
    const claims = await verifyGitHubActionsToken(authorization.slice(7));
    return { method: 'github_oidc', runId: claims.run_id };
  } catch {
    return null;
  }
};

module.exports = {
  JOB_AUDIENCE,
  authenticateBackgroundJob,
  safeEqual,
  validateGitHubActionsClaims,
  verifyGitHubActionsToken
};
