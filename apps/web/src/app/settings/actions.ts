'use server';

import { apiFetch } from '@/lib/api';

export async function deleteOrganization(orgId: string, confirmation: string) {
  const response = await apiFetch(`/orgs/${encodeURIComponent(orgId)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirmation }),
  });
  if (response.ok) return {};
  const body = await response.json().catch(() => ({})) as { message?: string };
  return { error: body.message ?? `HTTP ${response.status}` };
}