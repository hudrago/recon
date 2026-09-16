import { headers } from 'next/headers';

export interface ApiException {
  id: string;
  orgId: string;
  code: string;
  orderId: string;
  detectedAt: string;
  status: string;
  context: Record<string, unknown>;
}

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const cookie = (await headers()).get('cookie');
  const requestHeaders = new Headers(init.headers);
  if (cookie) requestHeaders.set('cookie', cookie);
  return fetch(`${API_URL}${path}`, { ...init, headers: requestHeaders, cache: 'no-store' });
}

export async function listExceptions(orgId: string): Promise<ApiException[]> {
  const res = await apiFetch(`/orgs/${orgId}/exceptions`);
  if (!res.ok) throw new Error(`Failed to load exceptions (${res.status})`);
  return res.json();
}

export async function getException(orgId: string, exceptionId: string): Promise<ApiException | null> {
  const res = await apiFetch(`/orgs/${orgId}/exceptions/${encodeURIComponent(exceptionId)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load exception (${res.status})`);
  return res.json();
}
