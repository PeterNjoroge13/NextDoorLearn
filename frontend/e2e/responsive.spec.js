import { expect, test } from '@playwright/test';

const apiUrl = 'http://127.0.0.1:3219/api';

test('welcome and sign-in pages stay within a compact viewport', async ({ page }) => {
  for (const path of ['/', '/login', '/signup']) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${path} has horizontal overflow`).toBeLessThanOrEqual(1);
  }
});

test('keyboard users can reveal the skip link', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.keyboard.press('Tab');
  const skipLink = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeVisible();
});

test('signed-in phone navigation keeps primary actions within thumb reach', async ({ page, request, isMobile }) => {
  test.skip(!isMobile || (page.viewportSize()?.width || 0) > 640, 'Phone navigation is only rendered at compact widths.');
  const email = `mobile.web.${Date.now()}@example.com`;
  const password = 'BrowserSmoke123!';
  const registration = await request.post(`${apiUrl}/auth/register`, {
    data: {
      email, password, role: 'student', name: 'Mobile Web Student', ageGroup: '18+',
      termsAccepted: true, privacyAccepted: true, safetyAccepted: true, consentSource: 'browser_smoke',
    },
  });
  expect(registration.ok()).toBeTruthy();

  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();
  await page.getByRole('button', { name: 'More navigation options' }).click();
  await expect(page.getByRole('dialog', { name: 'More' })).toBeVisible();
  await page.getByRole('link', { name: 'Payments' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Pay your tutor without leaving');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
