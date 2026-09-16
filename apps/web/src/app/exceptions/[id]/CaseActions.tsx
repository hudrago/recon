'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { approveException, dismissException, executeRefundAction } from './actions';

interface CaseActionsProps {
  orgId: string;
  exceptionId: string;
  orderId: string;
  status: string;
}

export function CaseActions({ orgId, exceptionId, orderId: _orderId, status }: CaseActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('');
  const [error, setError] = useState<string | null>(null);

  function runAction(action: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  if (status === 'resolved' || status === 'dismissed') {
    return <p className="mt-6 text-sm text-text-secondary">This case is {status} — no further action available.</p>;
  }

  return (
    <div className="mt-6 max-w-xl">
      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      {status === 'open' && (
        <div className="flex items-end gap-3">
          <label className="flex flex-col gap-1 text-sm text-text-secondary">
            Approved refund amount
            <input required type="number" step="0.01" min="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="rounded-md border border-border bg-background px-3 py-2 text-text-primary" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-text-secondary">
            Currency
            <input required type="text" maxLength={3} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} className="w-24 rounded-md border border-border bg-background px-3 py-2 text-text-primary uppercase" />
          </label>
          <button type="button" disabled={isPending || reason.trim().length === 0 || amount.length === 0 || !/^[A-Z]{3}$/.test(currency)} onClick={() => runAction(() => approveException(orgId, exceptionId, reason, amount, currency))} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            Approve
          </button>
        </div>
      )}

      {status === 'approved' && (
        <form onSubmit={(event) => { event.preventDefault(); runAction(() => executeRefundAction(orgId, exceptionId)); }}>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Confirm refund
          </button>
        </form>
      )}

      <div className="mt-4 flex items-end gap-3">
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Decision reason
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2 text-text-primary"
          />
        </label>
        <button
          type="button"
          disabled={isPending || reason.trim().length === 0}
          onClick={() => runAction(() => dismissException(orgId, exceptionId, reason))}
          className="rounded-lg border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
