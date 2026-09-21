import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const configPaths = [new URL('../vercel.json', import.meta.url), new URL('../../vercel.json', import.meta.url)];

for (const configPath of configPaths) {
  test(`production headers are secure and Stripe-compatible: ${configPath.pathname}`, async () => {
    const config = JSON.parse(await readFile(configPath, 'utf8'));
    const headers = Object.fromEntries(config.headers[0].headers.map(({ key, value }) => [key, value]));
    const policy = headers['Content-Security-Policy'];

    assert.match(policy, /script-src[^;]*https:\/\/js\.stripe\.com/);
    assert.match(policy, /frame-src[^;]*https:\/\/js\.stripe\.com/);
    assert.match(policy, /connect-src[^;]*https:\/\/api\.stripe\.com/);
    assert.match(policy, /object-src 'none'/);
    assert.match(policy, /frame-ancestors 'none'/);
    assert.equal(headers['X-Content-Type-Options'], 'nosniff');
    assert.equal(headers['X-Frame-Options'], 'DENY');
    assert.match(headers['Strict-Transport-Security'], /includeSubDomains/);
  });
}
