import { expect, test } from '@playwright/test';

test('public legal pages are linked, localized, and responsive', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.getByRole('link', { name: 'Privacidade' }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Política de Privacidade');
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-PT');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);

  await page.getByRole('button', { name: 'Idioma' }).click();
  await page.getByRole('menuitemradio', { name: 'English' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Privacy Policy');
  await page.getByRole('link', { name: 'Security' }).click();
  await expect(page).toHaveURL(/\/security$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Security at Recon');
});