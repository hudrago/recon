'use client';

import { useState, useTransition } from 'react';
import { Check, Mail } from 'lucide-react';
import { formatMoney } from '@recon/ui';
import { usePreferences } from '@/components/PreferencesProvider';
import type { ApiPlan } from '@/lib/api';
import { createCheckoutSession } from './actions';

interface BillingPlansProps {
  orgId: string;
  plans: ApiPlan[];
  enterprise: ApiPlan;
  currentPlanCode: string;
  isPaidActive: boolean;
}

export function BillingPlans({ orgId, plans, enterprise, currentPlanCode, isPaidActive }: BillingPlansProps) {
  const { locale, t } = usePreferences();
  const [isPending, startTransition] = useTransition();
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function choosePlan(planCode: string) {
    setError(null);
    setPendingPlan(planCode);
    startTransition(async () => {
      const result = await createCheckoutSession(orgId, planCode);
      if (result.error || !result.url) {
        setError(result.error ?? t('billing.error'));
        setPendingPlan(null);
        return;
      }
      // Full navigation, not router.push — the destination is Stripe Checkout, not an app route.
      window.location.href = result.url;
    });
  }

  return (
    <section aria-labelledby="plans-title">
      <div className="plans-heading">
        <p className="eyebrow">{t('billing.plans.title')}</p>
        <h2 id="plans-title">{t('billing.plans.subtitle')}</h2>
      </div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <div className="plan-grid">
        {plans.map((plan) => {
          const isCurrent = isPaidActive && plan.code === currentPlanCode;
          return (
            <div key={plan.code} className={`plan-card${isCurrent ? ' is-current' : ''}`}>
              <div className="plan-card-header">
                <strong>{plan.name}</strong>
                {isCurrent ? <span className="status-badge status-approved">{t('billing.plan.current')}</span> : null}
              </div>
              <p className="plan-price">
                {formatMoney((plan.priceCents ?? 0) / 100, plan.currency, locale === 'pt' ? 'pt-PT' : 'en-GB')}
                <span>{t('billing.plan.perMonth')}</span>
              </p>
              <p className="plan-limit">{t('billing.plan.orderLimit', { count: plan.monthlyOrderLimit ?? 0 })}</p>
              <button
                type="button"
                className="button button-secondary"
                disabled={isCurrent || isPending}
                onClick={() => choosePlan(plan.code)}
              >
                <Check size={16} aria-hidden="true" />
                {isPending && pendingPlan === plan.code ? t('billing.plan.processing') : t('billing.plan.choose')}
              </button>
            </div>
          );
        })}
        <div className="plan-card plan-card-enterprise">
          <div className="plan-card-header"><strong>{enterprise.name}</strong></div>
          <p className="plan-limit">{t('billing.plan.enterprise.description')}</p>
          <a className="button button-secondary" href="mailto:sales@recon.app">
            <Mail size={16} aria-hidden="true" />
            {t('billing.plan.enterprise.contact')}
          </a>
        </div>
      </div>
    </section>
  );
}
