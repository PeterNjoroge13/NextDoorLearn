const apiUrl = String(process.env.LOAD_API_URL || 'http://127.0.0.1:3001/api').replace(/\/$/, '');
const parsedUrl = new URL(apiUrl);
const localTarget = ['localhost', '127.0.0.1', '::1'].includes(parsedUrl.hostname);
if (!localTarget && process.env.ALLOW_PRODUCTION_LOAD_TEST !== 'true') {
  throw new Error('Refusing to load test a non-local target without ALLOW_PRODUCTION_LOAD_TEST=true');
}

const boundedInteger = (value, fallback, max) => {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 ? Math.min(number, max) : fallback;
};
const concurrency = boundedInteger(process.env.LOAD_CONCURRENCY, 10, 50);
const requestCount = boundedInteger(process.env.LOAD_REQUESTS, 200, 5000);
const maxP95Ms = boundedInteger(process.env.LOAD_MAX_P95_MS, 1000, 30000);
const paths = String(process.env.LOAD_PATHS || '/health')
  .split(',')
  .map((path) => path.trim())
  .filter((path) => path.startsWith('/') && !path.includes('..'));
if (!paths.length) throw new Error('LOAD_PATHS must include at least one API path');

const durations = [];
const statuses = new Map();
let nextRequest = 0;
let networkErrors = 0;

const worker = async () => {
  while (nextRequest < requestCount) {
    const index = nextRequest;
    nextRequest += 1;
    const path = paths[index % paths.length];
    const startedAt = performance.now();
    try {
      const response = await fetch(`${apiUrl}${path}`, {
        headers: process.env.LOAD_AUTH_TOKEN ? { Authorization: `Bearer ${process.env.LOAD_AUTH_TOKEN}` } : {}
      });
      durations.push(performance.now() - startedAt);
      statuses.set(response.status, (statuses.get(response.status) || 0) + 1);
      await response.body?.cancel();
    } catch {
      durations.push(performance.now() - startedAt);
      networkErrors += 1;
    }
  }
};

const percentile = (values, ratio) => values[Math.min(values.length - 1, Math.floor(values.length * ratio))] || 0;

const main = async () => {
  const startedAt = performance.now();
  await Promise.all(Array.from({ length: Math.min(concurrency, requestCount) }, worker));
  const elapsedMs = performance.now() - startedAt;
  durations.sort((a, b) => a - b);
  const successful = [...statuses.entries()].reduce(
    (sum, [status, count]) => sum + (status >= 200 && status < 400 ? count : 0),
    0
  );
  const successRate = successful / requestCount;
  const report = {
    target: apiUrl,
    paths,
    requests: requestCount,
    concurrency,
    durationMs: Math.round(elapsedMs),
    requestsPerSecond: Number((requestCount / (elapsedMs / 1000)).toFixed(2)),
    latencyMs: {
      p50: Math.round(percentile(durations, 0.5)),
      p95: Math.round(percentile(durations, 0.95)),
      p99: Math.round(percentile(durations, 0.99))
    },
    statuses: Object.fromEntries(statuses),
    networkErrors,
    successRate: Number(successRate.toFixed(4))
  };
  console.log(JSON.stringify(report, null, 2));
  if (successRate < 0.99 || report.latencyMs.p95 > maxP95Ms) process.exit(1);
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
