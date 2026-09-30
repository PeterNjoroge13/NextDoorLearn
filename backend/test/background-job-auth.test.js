const { generateKeyPairSync } = require('crypto');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const {
  JOB_AUDIENCE,
  safeEqual,
  validateGitHubActionsClaims,
  verifyGitHubActionsToken
} = require('../src/services/backgroundJobAuth');

const repository = 'PeterNjoroge13/NextDoorLearn';
const ref = 'refs/heads/main';
const workflowRef = `${repository}/.github/workflows/reminders.yml@${ref}`;
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicJwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key', use: 'sig', alg: 'RS256' };

const withJobIdentity = async (callback) => {
  const original = {
    repository: process.env.GITHUB_ACTIONS_JOB_REPOSITORY,
    ref: process.env.GITHUB_ACTIONS_JOB_REF,
    workflow: process.env.GITHUB_ACTIONS_JOB_WORKFLOW
  };
  process.env.GITHUB_ACTIONS_JOB_REPOSITORY = repository;
  process.env.GITHUB_ACTIONS_JOB_REF = ref;
  process.env.GITHUB_ACTIONS_JOB_WORKFLOW = '.github/workflows/reminders.yml';
  try {
    await callback();
  } finally {
    if (original.repository === undefined) delete process.env.GITHUB_ACTIONS_JOB_REPOSITORY;
    else process.env.GITHUB_ACTIONS_JOB_REPOSITORY = original.repository;
    if (original.ref === undefined) delete process.env.GITHUB_ACTIONS_JOB_REF;
    else process.env.GITHUB_ACTIONS_JOB_REF = original.ref;
    if (original.workflow === undefined) delete process.env.GITHUB_ACTIONS_JOB_WORKFLOW;
    else process.env.GITHUB_ACTIONS_JOB_WORKFLOW = original.workflow;
  }
};

const signToken = (overrides = {}) => jwt.sign({
  repository,
  ref,
  ref_type: 'branch',
  workflow_ref: workflowRef,
  event_name: 'schedule',
  runner_environment: 'github-hosted',
  run_id: '12345',
  ...overrides
}, privateKey, {
  algorithm: 'RS256',
  keyid: 'test-key',
  issuer: 'https://token.actions.githubusercontent.com',
  audience: JOB_AUDIENCE,
  expiresIn: '5m'
});

test('GitHub Actions OIDC authorizes only the production background-job workflow', async () => {
  await withJobIdentity(async () => {
    const claims = await verifyGitHubActionsToken(signToken(), async () => [publicJwk]);
    assert.equal(claims.repository, repository);
    assert.equal(claims.run_id, '12345');

    await assert.rejects(
      verifyGitHubActionsToken(signToken({ workflow_ref: `${repository}/.github/workflows/ci.yml@${ref}` }), async () => [publicJwk]),
      /workflow is not authorized/
    );
    await assert.rejects(
      verifyGitHubActionsToken(signToken({ event_name: 'pull_request' }), async () => [publicJwk]),
      /event is not authorized/
    );
    await assert.rejects(
      verifyGitHubActionsToken(signToken({ repository: 'attacker/example' }), async () => [publicJwk]),
      /repository is not authorized/
    );
  });
});

test('background-job shared secrets use length-safe constant-time comparison', () => {
  assert.equal(safeEqual('same-secret', 'same-secret'), true);
  assert.equal(safeEqual('wrong-secret', 'same-secret'), false);
  assert.equal(safeEqual('short', 'much-longer-secret'), false);
  assert.throws(() => validateGitHubActionsClaims({}), /not configured/);
});
