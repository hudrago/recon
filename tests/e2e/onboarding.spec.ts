import { expect, test } from '@playwright/test';

test('account onboarding reaches the inbox and cleans up the workspace and account', async ({ page }) => {
  test.setTimeout(60_000);
  const suffix = Date.now().toString(36);
  const email = `e2e-${suffix}@example.com`;
  const password = 'ReconE2E!2026';
  const organizationName = `Recon E2E ${suffix}`;

  await page.goto('/sign-up');
  await page.getByLabel('Nome').fill('Recon E2E');
  await page.getByLabel('Email profissional').fill(email);
  await page.getByLabel('Palavra-passe').fill(password);
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page).toHaveURL(/\/onboarding$/, { timeout: 15_000 });

  await page.getByLabel('Nome da organização').fill(organizationName);
  await page.getByRole('button', { name: 'Criar organização' }).click();
  await expect(page).toHaveURL(/\/exceptions$/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Caixa de entrada');

  await page.goto('/settings');
  await page.getByRole('button', { name: 'Eliminar espaço' }).click();
  const organizationDialog = page.getByRole('dialog');
  const confirmation = await organizationDialog.locator('.field span').innerText();
  await organizationDialog.locator('input[name="confirmation"]').fill(confirmation);
  await organizationDialog.getByRole('button', { name: 'Eliminar definitivamente' }).click();
  await expect(page).toHaveURL(/\/onboarding$/, { timeout: 15_000 });

  await page.goto('/settings');
  await page.getByRole('button', { name: 'Eliminar conta' }).click();
  const accountDialog = page.getByRole('dialog');
  await accountDialog.getByLabel('Palavra-passe atual').fill(password);
  await accountDialog.getByRole('button', { name: 'Eliminar definitivamente' }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
  await expect(page.getByRole('link', { name: 'Começar', exact: true })).toBeVisible();
});