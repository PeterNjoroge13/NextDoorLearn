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
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
};

const signIn = async (page, email) => {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
  await expect(page).toHaveURL(/\/dashboard$/);
};

test('student can use safety dialogs with keyboard support and block a tutor', async ({ page, request }) => {
  const runId = `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
  const tutor = await register(request, 'tutor', `dialog.tutor.${runId}@example.com`, 'Dialog Tutor');
  const studentEmail = `dialog.student.${runId}@example.com`;
  await register(request, 'student', studentEmail, 'Dialog Student');
  await signIn(page, studentEmail);

  await page.goto(`/tutors/${tutor.user.id}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1, name: 'Dialog Tutor' })).toBeVisible();

  const reportButton = page.getByRole('button', { name: 'Report profile' });
  await reportButton.click();
  const reportDialog = page.getByRole('dialog', { name: 'Report Dialog Tutor' });
  await expect(reportDialog).toBeVisible();
  await expect(page.getByLabel('Reason')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(reportDialog).toBeHidden();
  await expect(reportButton).toBeFocused();

  const blockButton = page.getByRole('button', { name: 'Block tutor' });
  await blockButton.click();
  const blockDialog = page.getByRole('dialog', { name: 'Block Dialog Tutor?' });
  await expect(blockDialog).toBeVisible();
  await expect(blockDialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(blockDialog).toBeHidden();
  await expect(blockButton).toBeFocused();

  await blockButton.click();
  await blockDialog.getByRole('button', { name: 'Block tutor' }).click();
  await expect(page).toHaveURL(/\/tutors$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Find someone who teaches the way you learn');
});

test('student gets clear confirmation before deleting goals or an account', async ({ page, request }) => {
  const runId = `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
  const email = `dialog.delete.${runId}@example.com`;
  const student = await register(request, 'student', email, 'Delete Dialog Student');
  const goalResponse = await request.post(`${apiUrl}/progress/goals`, {
    headers: { Authorization: `Bearer ${student.token}` },
    data: { subject: 'Algebra', title: 'Browser deletion goal', description: 'Disposable browser test data.' },
  });
  expect(goalResponse.ok(), await goalResponse.text()).toBeTruthy();
  await signIn(page, email);

  await page.goto('/progress', { waitUntil: 'domcontentloaded' });
  const deleteGoalButton = page.getByRole('button', { name: 'Delete Browser deletion goal' });
  await deleteGoalButton.click();
  const goalDialog = page.getByRole('dialog', { name: 'Delete this learning goal?' });
  await expect(goalDialog).toContainText('Browser deletion goal');
  await page.keyboard.press('Escape');
  await expect(goalDialog).toBeHidden();
  await expect(deleteGoalButton).toBeFocused();
  await deleteGoalButton.click();
  await goalDialog.getByRole('button', { name: 'Delete goal' }).click();
  await expect(page.getByRole('heading', { name: 'No learning goals here' })).toBeVisible();

  await page.goto('/profile?tab=security', { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Current password').last().fill(password);
  const deleteAccountButton = page.getByRole('button', { name: 'Permanently delete account' });
  await deleteAccountButton.click();
  const accountDialog = page.getByRole('dialog', { name: 'Permanently delete your account?' });
  await expect(accountDialog).toContainText('cannot be undone');
  await page.keyboard.press('Escape');
  await expect(accountDialog).toBeHidden();
  await expect(deleteAccountButton).toBeFocused();
});
