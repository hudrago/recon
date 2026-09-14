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

export function CaseActions({ orgId, exceptionId, orderId, status }: CaseActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');
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
        <button
          type="button"
          disabled={isPending}
          onClick={() => runAction(() => approveException(orgId, exceptionId))}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Approve
        </button>
      )}

      {status === 'approved' && (
        <form
          className="flex items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            runAction(() => executeRefundAction(orgId, exceptionId, orderId, amount));
          }}
        >
          <label className="flex flex-col gap-1 text-sm text-text-secondary">
            Refund amount (EUR) — entered manually, order total isn&apos;t wired in yet
            <input
              required
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-text-primary"
            />
          </label>
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
          Dismiss reason
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
