'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';

export async function approveException(orgId: string, exceptionId: string, reason: string, amountInput: string, currencyInput: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(amountInput)) return { error: 'Introduza um valor válido com, no máximo, duas casas decimais.' };
  const amountMinor = Math.round(Number(amountInput) * 100);
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) return { error: 'Introduza um valor válido.' };
  const currency = currencyInput.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) return { error: 'Introduza um código de moeda válido com três letras.' };
  const res = await apiFetch(`/orgs/${orgId}/exceptions/${exceptionId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason, amountMinor, currency }),
  });
  if (!res.ok) return { error: `Não foi possível aprovar (${res.status}).` };
  revalidatePath(`/exceptions/${exceptionId}`);
  return {};
}

export async function dismissException(orgId: string, exceptionId: string, reason: string) {
  const res = await apiFetch(`/orgs/${orgId}/exceptions/${exceptionId}/dismiss`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) return { error: `Não foi possível arquivar (${res.status}).` };
  revalidatePath(`/exceptions/${exceptionId}`);
  return {};
}

export async function executeRefundAction(orgId: string, exceptionId: string) {
  const res = await apiFetch(`/orgs/${orgId}/exceptions/${exceptionId}/actions/refund`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!res.ok) return { error: `Não foi possível executar o reembolso (${res.status}).` };
  revalidatePath(`/exceptions/${exceptionId}`);
  return {};
}
