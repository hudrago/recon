import { expect, test } from '@playwright/test';
import { createE2eAccount, getActiveOrganizationId, signUpAndCreateOrganization } from './helpers/account';
import { seedRefundMissingException } from './helpers/seed';

test('approves and executes a refund, and shows both decisions in the case timeline', async ({ page }) => {
  test.setTimeout(60_000);
  const account = createE2eAccount('approval');

  await signUpAndCreateOrganization(page, account);
  const orgId = await getActiveOrganizationId(page);
  const { orderId } = await seedRefundMissingException(orgId);

  await page.goto('/exceptions');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('A resolver');
  await Promise.all([
    page.waitForURL(/\/exceptions\/.+/),
    page.getByRole('link').filter({ hasText: orderId }).click(),
  ]);
  await expect(page.getByRole('heading', { name: 'Reembolso em falta' })).toBeVisible();

  await page.getByLabel('Valor do reembolso').fill('19.90');
  await page.getByLabel('Moeda').fill('EUR');
  await page.getByLabel('Motivo da decisão').fill('Cliente confirmou devolução no armazém');
  await page.getByRole('button', { name: 'Aprovar recomendação' }).click();
  const approvalDialog = page.getByRole('dialog');
  await expect(approvalDialog.getByRole('heading', { name: 'Confirmar aprovação' })).toBeVisible();
  await approvalDialog.getByRole('button', { name: 'Sim, aprovar' }).click();
  await expect(approvalDialog).toBeHidden();

  await expect(page.getByRole('button', { name: 'Confirmar reembolso' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar reembolso' }).click();
  const executeDialog = page.getByRole('dialog');
  await expect(executeDialog.getByRole('heading', { name: 'Executar reembolso' })).toBeVisible();
  await executeDialog.getByRole('button', { name: 'Sim, executar' }).click();
  await expect(executeDialog).toBeHidden();

  await expect(page.getByText('Decisão concluída')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Histórico' })).toBeVisible();
  await expect(page.locator('.timeline-item')).toHaveCount(2);
});
