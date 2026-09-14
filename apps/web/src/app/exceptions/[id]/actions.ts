'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';

export async function approveException(orgId: string, exceptionId: string) {
  const res = await apiFetch(`/orgs/${orgId}/exceptions/${exceptionId}/approve`, { method: 'POST' });
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

// Amount is entered manually because the exception's context doesn't carry a monetary amount
// yet (packages/domain doesn't associate REFUND_MISSING with an order total) — a known gap,
// not a design choice. The idempotency key is deterministic per exception, not per click, so
// resubmitting after a network hiccup never risks a duplicate refund.
export async function executeRefundAction(orgId: string, exceptionId: string, orderId: string, amountInput: string) {
  const amount = Number(amountInput);
  if (!Number.isFinite(amount) || amount <= 0) return { error: 'Enter a valid amount' };

  const res = await apiFetch(`/orgs/${orgId}/exceptions/${exceptionId}/actions/refund`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idempotencyKey: `refund:${exceptionId}`,
      orderId,
      amount,
      currency: 'EUR',
    }),
  });
  if (!res.ok) return { error: `Failed to execute refund (${res.status})` };
  revalidatePath(`/exceptions/${exceptionId}`);
  return {};
}
