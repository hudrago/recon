import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export interface E2eAccount {
  email: string;
  password: string;
  organizationName: string;
}

export function createE2eAccount(prefix: string): E2eAccount {
  const suffix = `${prefix}-${Date.now().toString(36)}`;
  return {
    email: `${suffix}@example.com`,
    password: 'ReconE2E!2026',
    organizationName: `Recon E2E ${suffix}`,
  };
}

// Signs up, creates an organization, and lands on the inbox — the shared first half of every
// e2e flow that needs an authenticated session with an active organization.
export async function signUpAndCreateOrganization(page: Page, account: E2eAccount): Promise<void> {
  await page.goto('/sign-up');
  await page.getByLabel('Nome').fill('Recon E2E');
  await page.getByLabel('Email profissional').fill(account.email);
  await page.getByLabel('Palavra-passe').fill(account.password);
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page).toHaveURL(/\/onboarding$/, { timeout: 15_000 });

  await page.getByLabel('Nome da organização').fill(account.organizationName);
  await page.getByRole('button', { name: 'Criar organização' }).click();
  await expect(page).toHaveURL(/\/exceptions$/, { timeout: 15_000 });
}

// Reads the active organization id from the authenticated session — used to seed fixture data
// directly against the e2e database for the org the UI just created.
export async function getActiveOrganizationId(page: Page): Promise<string> {
  const response = await page.request.get('/api/auth/get-session');
  const body = await response.json() as { session?: { activeOrganizationId?: string | null } };
  const orgId = body.session?.activeOrganizationId;
  if (!orgId) throw new Error('Expected an active organization id in the session response');
  return orgId;
}
