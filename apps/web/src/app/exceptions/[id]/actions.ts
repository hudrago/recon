'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';
import { encodeExceptionRouteId } from '@/lib/exception-route';

export async function approveException(orgId: string, exceptionId: string, reason: string, amountInput: string, currencyInput: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(amountInput)) return { error: 'Introduza um valor válido com, no máximo, duas casas decimais.' };
  const amountMinor = Math.round(Number(amountInput) * 100);
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) return { error: 'Introduza um valor válido.' };
  const currency = currencyInput.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) return { error: 'Introduza um código de moeda válido com três letras.' };
  const res = await apiFetch(`/orgs/${orgId}/exceptions/${encodeURIComponent(exceptionId)}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason, amountMinor, currency }),
  });
  if (!res.ok) return { error: `Não foi possível aprovar (${res.status}).` };
  revalidatePath(`/exceptions/${encodeExceptionRouteId(exceptionId)}`);
  return {};
}

export async function approveRestockException(
  orgId: string,
  exceptionId: string,
  reason: string,
  quantityInput: string,
) {
  if (!/^\d+$/.test(quantityInput))
    return { error: "Introduza uma quantidade válida." };
  const quantity = Number(quantityInput);
  if (!Number.isSafeInteger(quantity) || quantity <= 0)
    return { error: "Introduza uma quantidade válida." };
  const res = await apiFetch(
    `/orgs/${orgId}/exceptions/${encodeURIComponent(exceptionId)}/approve`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, quantity }),
    },
  );
  if (!res.ok) return { error: `Não foi possível aprovar (${res.status}).` };
  revalidatePath(`/exceptions/${encodeExceptionRouteId(exceptionId)}`);
  return {};
}

export async function approveWithoutTerms(
  orgId: string,
  exceptionId: string,
  reason: string,
) {
  const res = await apiFetch(
    `/orgs/${orgId}/exceptions/${encodeURIComponent(exceptionId)}/approve`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    },
  );
  if (!res.ok) return { error: `Não foi possível aprovar (${res.status}).` };
  revalidatePath(`/exceptions/${encodeExceptionRouteId(exceptionId)}`);
  return {};
}

export async function dismissException(
  orgId: string,
  exceptionId: string,
  reason: string,
) {
  const res = await apiFetch(
    `/orgs/${orgId}/exceptions/${encodeURIComponent(exceptionId)}/dismiss`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    },
  );
  if (!res.ok) return { error: `Não foi possível arquivar (${res.status}).` };
  revalidatePath(`/exceptions/${encodeExceptionRouteId(exceptionId)}`);
  return {};
}

export async function executeRefundAction(orgId: string, exceptionId: string) {
  const res = await apiFetch(
    `/orgs/${orgId}/exceptions/${encodeURIComponent(exceptionId)}/actions/refund`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    },
  );
  if (!res.ok)
    return { error: `Não foi possível executar o reembolso (${res.status}).` };
  revalidatePath(`/exceptions/${encodeExceptionRouteId(exceptionId)}`);
  return {};
}

export async function executeRestockAction(orgId: string, exceptionId: string) {
  const res = await apiFetch(
    `/orgs/${orgId}/exceptions/${encodeURIComponent(exceptionId)}/actions/restock`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    },
  );
  if (!res.ok)
    return { error: `Não foi possível repor o stock (${res.status}).` };
  revalidatePath(`/exceptions/${encodeExceptionRouteId(exceptionId)}`);
  return {};
}

export async function executeIssueInvoiceAction(
  orgId: string,
  exceptionId: string,
) {
  const res = await apiFetch(
    `/orgs/${orgId}/exceptions/${encodeURIComponent(exceptionId)}/actions/invoice`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    },
  );
  if (!res.ok)
    return { error: `Não foi possível emitir a fatura (${res.status}).` };
  revalidatePath(`/exceptions/${encodeExceptionRouteId(exceptionId)}`);
  return {};
}
