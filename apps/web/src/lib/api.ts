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

export interface ApiEntitlement {
  planCode: string;
  displayStatus: "trialing" | "grace" | "active" | "read_only";
  monthlyOrderLimit: number | null;
  processedOrderCount: number;
  usagePercent: number;
  usageWarning: boolean;
  overLimit: boolean;
  canIngest: boolean;
  canExecuteActions: boolean;
  trialEndsAt: string | null;
  graceEndsAt: string | null;
}

export interface ApiPlan {
  code: string;
  name: string;
  priceCents: number | null;
  currency: string;
  monthlyOrderLimit: number | null;
  selfServe: boolean;
}

export interface ApiPlanCatalog {
  plans: ApiPlan[];
  enterprise: ApiPlan;
}

const API_URL = process.env.API_URL ?? "http://localhost:3001";

export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const cookie = (await headers()).get("cookie");
  const requestHeaders = new Headers(init.headers);
  if (cookie) requestHeaders.set("cookie", cookie);
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: requestHeaders,
    cache: "no-store",
  });
}

export async function listExceptions(orgId: string): Promise<ApiException[]> {
  const res = await apiFetch(`/orgs/${orgId}/exceptions`);
  if (!res.ok) throw new Error(`Failed to load exceptions (${res.status})`);
  return res.json();
}

export async function getBillingStatus(orgId: string): Promise<ApiEntitlement> {
  const res = await apiFetch(`/orgs/${orgId}/billing`);
  if (!res.ok) throw new Error(`Failed to load billing status (${res.status})`);
  return res.json();
}

export async function getBillingPlans(orgId: string): Promise<ApiPlanCatalog> {
  const res = await apiFetch(`/orgs/${orgId}/billing/plans`);
  if (!res.ok) throw new Error(`Failed to load billing plans (${res.status})`);
  return res.json();
}

export async function getException(orgId: string, exceptionId: string): Promise<ApiException | null> {
  const res = await apiFetch(`/orgs/${orgId}/exceptions/${encodeURIComponent(exceptionId)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load exception (${res.status})`);
  return res.json();
}
