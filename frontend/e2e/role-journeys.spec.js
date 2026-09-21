import { expect, test } from '@playwright/test';

const apiUrl = 'http://127.0.0.1:3219/api';
const password = 'BrowserSmoke123!';
const consent = {
  ageGroup: '18+',
  termsAccepted: true,
  privacyAccepted: true,
  safetyAccepted: true,
  consentSource: 'browser_smoke',
};

const register = async (request, role, email, name) => {
  const response = await request.post(`${apiUrl}/auth/register`, {
    data: { email, password, role, name, ...consent },
  });
  if (response.status() === 400) {
    const payload = await response.json();
    if (payload.error === 'User with this email already exists') return;
  }
  expect(response.ok(), await response.text()).toBeTruthy();
};

const signIn = async (page, email) => {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
  await expect(page).toHaveURL(/\/dashboard$/);
};

test('public visitor can reach account and safety routes', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Free and low-cost tutoring');
  await page.getByRole('link', { name: /sign up/i }).first().click();
  await expect(page.getByRole('heading', { name: 'Create your account.' })).toBeVisible();
  await page.goto('/guidelines', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('student can sign in, open payments, and sign out', async ({ page, request }) => {
  const email = `browser.student.${Date.now()}@example.com`;
  await register(request, 'student', email, 'Browser Student');
  await signIn(page, email);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('What can we make easier today');
  await page.getByRole('link', { name: 'Payments' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Pay your tutor without leaving');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('tutor sees the teaching and earnings workspaces', async ({ page, request }) => {
  const email = `browser.tutor.${Date.now()}@example.com`;
  await register(request, 'tutor', email, 'Browser Tutor');
  await signIn(page, email);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Your time can change');
  await page.getByRole('link', { name: 'Earnings' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Get paid without chasing invoices');
});

test('administrator can open the protected moderation console', async ({ page, request }) => {
  const email = 'browser.admin@example.com';
  await register(request, 'student', email, 'Browser Admin');
  await signIn(page, email);
  await page.getByRole('link', { name: 'Admin' }).click();
  await expect(page.getByRole('heading', { name: 'Run the community with care.' })).toBeVisible();
});

test('stale saved credentials recover to sign in instead of a broken dashboard', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'expired-token');
    localStorage.setItem('refreshToken', 'expired-refresh-token');
    localStorage.setItem('user', JSON.stringify({ id: 999999, name: 'Expired User', role: 'student' }));
  });
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Sign in to continue.' })).toBeVisible();
});
