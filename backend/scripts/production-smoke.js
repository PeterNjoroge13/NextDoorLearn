const API_BASE_URL = (process.env.SMOKE_API_URL || '').replace(/\/$/, '');
const FRONTEND_ORIGIN = process.env.SMOKE_FRONTEND_ORIGIN || '';

if (!API_BASE_URL || !FRONTEND_ORIGIN) {
  throw new Error('Set SMOKE_API_URL and SMOKE_FRONTEND_ORIGIN before running the production smoke check');
}

const fetchJson = async (path, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  const body = await response.json().catch(() => ({}));
  return { response, body };
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const main = async () => {
  const health = await fetchJson('/health', {
    headers: { Origin: FRONTEND_ORIGIN }
  });
  assert(health.response.ok, `Health check failed with ${health.response.status}`);
  assert(health.body.status === 'ok', 'Health check did not return status=ok');
  assert(health.body.database === 'ok', 'Production database check failed');
  assert(
    health.response.headers.get('access-control-allow-origin') === FRONTEND_ORIGIN,
    'Configured frontend origin was not accepted by CORS'
  );

  const protectedRoute = await fetchJson('/users/profile');
  assert(protectedRoute.response.status === 401, 'Protected profile route did not reject an anonymous request');

  const invalidLogin = await fetchJson('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'production-smoke-invalid@example.com', password: 'not-a-real-password' })
  });
  assert(invalidLogin.response.status === 401, 'Invalid credentials did not return 401');

  const blockedCors = await fetchJson('/health', {
    headers: { Origin: 'https://untrusted.nextdoorlearn.invalid' }
  });
  assert(blockedCors.response.status === 403, 'Untrusted origin was not rejected with 403');
  assert(!blockedCors.response.headers.get('access-control-allow-origin'), 'Untrusted origin received a CORS allow header');

  console.log(JSON.stringify({
    status: 'ok',
    database: health.body.database,
    email: health.body.email,
    emailVerification: health.body.emailVerification,
    zoom: health.body.zoom,
    googleCalendar: health.body.googleCalendar,
    mediaStorage: health.body.mediaStorage
  }, null, 2));
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
