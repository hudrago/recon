'use server';

import { apiFetch } from '@/lib/api';

export async function createCheckoutSession(orgId: string, planCode: string) {
  const res = await apiFetch(`/orgs/${orgId}/billing/checkout-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planCode }),
  });
  if (!res.ok) return { error: `Não foi possível iniciar o checkout (${res.status}).` };
  const body = (await res.json()) as { url: string };
  return { url: body.url };
}
