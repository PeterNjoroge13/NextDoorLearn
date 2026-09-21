import { expect, test } from '@playwright/test';

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
