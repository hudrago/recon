'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';

export async function approveException(orgId: string, exceptionId: string, reason: string, amountInput: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(amountInput)) return { error: 'Enter a valid amount with at most two decimals' };
  const amountMinor = Math.round(Number(amountInput) * 100);
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) return { error: 'Enter a valid amount' };
  const res = await apiFetch(`/orgs/${orgId}/exceptions/${exceptionId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason, amountMinor, currency: 'EUR' }),
  });
  if (!res.ok) return { error: `Failed to approve (${res.status})` };
  revalidatePath(`/exceptions/${exceptionId}`);
  return {};
}

export async function dismissException(orgId: string, exceptionId: string, reason: string) {
  const res = await apiFetch(`/orgs/${orgId}/exceptions/${exceptionId}/dismiss`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) return { error: `Failed to dismiss (${res.status})` };
  revalidatePath(`/exceptions/${exceptionId}`);
  return {};
}

export async function executeRefundAction(orgId: string, exceptionId: string) {
  const res = await apiFetch(`/orgs/${orgId}/exceptions/${exceptionId}/actions/refund`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!res.ok) return { error: `Failed to execute refund (${res.status})` };
  revalidatePath(`/exceptions/${exceptionId}`);
  return {};
}
