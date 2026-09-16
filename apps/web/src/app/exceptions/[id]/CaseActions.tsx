'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, Check, ShieldCheck } from 'lucide-react';
import { usePreferences } from '@/components/PreferencesProvider';
import { approveException, dismissException, executeRefundAction } from './actions';

interface CaseActionsProps {
  orgId: string;
  exceptionId: string;
  orderId: string;
  status: string;
}

export function CaseActions({ orgId, exceptionId, orderId, status }: CaseActionsProps) {
  const router = useRouter();
  const { t } = usePreferences();
  const [isPending, startTransition] = useTransition();
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<'approve' | 'refund' | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const dialogTriggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!confirmation) return;
    confirmButtonRef.current?.focus();
    function handleDialogKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setConfirmation(null);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener('keydown', handleDialogKey);
    return () => {
      window.removeEventListener('keydown', handleDialogKey);
      dialogTriggerRef.current?.focus();
    };
  }, [confirmation]);

  function openConfirmation(type: 'approve' | 'refund', trigger: HTMLElement) {
    dialogTriggerRef.current = trigger;
    setConfirmation(type);
  }

  function runAction(action: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result?.error) {
        setError(result.error);
        return;
      }
      setConfirmation(null);
      router.refresh();
    });
  }

  if (status === 'resolved' || status === 'dismissed') {
    return <section className="decision-panel"><ShieldCheck aria-hidden="true" /><h2>{t('actions.completed')}</h2><p>{t('actions.completedDescription', { state: status === 'resolved' ? t('actions.state.resolved') : t('actions.state.dismissed') })}</p></section>;
  }

  return (
    <section className="decision-panel" aria-labelledby="decision-title">
      <p className="eyebrow">{t('actions.eyebrow')}</p>
      <h2 id="decision-title">{status === 'approved' ? t('actions.executeTitle') : t('actions.reviewTitle')}</h2>
      <p className="decision-intro">{status === 'approved' ? t('actions.executeIntro') : t('actions.reviewIntro')}</p>
      {error && <p className="form-error" role="alert">{error}</p>}

      {status === 'open' && (
        <div className="decision-fields">
          <label className="field">
            {t('actions.amount')}
            <input required type="number" inputMode="decimal" step="0.01" min="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </label>
          <label className="field currency-field">
            {t('actions.currency')}
            <input required type="text" maxLength={3} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} placeholder="EUR" />
          </label>
        </div>
      )}

      <div className="decision-reason">
        <label className="field">
          {t('actions.reason')}
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t('actions.reasonPlaceholder')}
          />
        </label>
      </div>
      <div className="decision-actions">
        {status === 'open' ? (
          <button type="button" disabled={isPending || reason.trim().length === 0 || amount.length === 0 || !/^[A-Z]{3}$/.test(currency)} onClick={(event) => openConfirmation('approve', event.currentTarget)} className="button">
            <Check size={17} aria-hidden="true" /> {t('actions.approve')}
          </button>
        ) : (
          <button type="button" disabled={isPending} onClick={(event) => openConfirmation('refund', event.currentTarget)} className="button">
            <ShieldCheck size={17} aria-hidden="true" /> {t('actions.confirmRefund')}
          </button>
        )}
        <button
          type="button"
          disabled={isPending || reason.trim().length === 0}
          onClick={() => runAction(() => dismissException(orgId, exceptionId, reason))}
          className="button button-secondary"
        >
          <Archive size={17} aria-hidden="true" /> {t('actions.dismiss')}
        </button>
      </div>

      {confirmation ? (
        <div className="dialog-backdrop">
          <div ref={dialogRef} className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description">
            <span className="dialog-icon"><ShieldCheck size={22} aria-hidden="true" /></span>
            <h3 id="confirm-title">{confirmation === 'approve' ? t('actions.confirmApprovalTitle') : t('actions.confirmRefundTitle')}</h3>
            <p id="confirm-description">{confirmation === 'approve' ? t('actions.confirmApprovalDescription', { amount, currency, orderId }) : t('actions.confirmRefundDescription', { orderId })}</p>
            <dl><div><dt>{t('actions.reasonSummary')}</dt><dd>{reason || t('actions.previousReason')}</dd></div></dl>
            <div className="dialog-actions">
              <button type="button" className="button button-secondary" onClick={() => setConfirmation(null)}>{t('common.cancel')}</button>
              <button ref={confirmButtonRef} type="button" className="button" disabled={isPending} onClick={() => runAction(() => confirmation === 'approve' ? approveException(orgId, exceptionId, reason, amount, currency) : executeRefundAction(orgId, exceptionId))}>
                {isPending ? t('common.processing') : confirmation === 'approve' ? t('actions.yesApprove') : t('actions.yesExecute')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
