import { AlertTriangle, CalendarClock, Gauge } from 'lucide-react';
import { getBillingPlans, getBillingStatus } from '@/lib/api';
import { billingStatusLabel } from '@/lib/presentation';
import { getTranslations } from '@/lib/server-i18n';
import { requireActiveOrganization } from '@/lib/session';
import { BillingPlans } from './BillingPlans';

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const { orgId } = await requireActiveOrganization();
  const { locale, t } = await getTranslations();
  const { checkout } = await searchParams;
  const [entitlement, catalog] = await Promise.all([getBillingStatus(orgId), getBillingPlans(orgId)]);

  const periodEndsAt = entitlement.displayStatus === 'trialing' ? entitlement.trialEndsAt : entitlement.displayStatus === 'grace' ? entitlement.graceEndsAt : null;
  const dateFormat = (value: string) => new Date(value).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'en-GB', { dateStyle: 'long' });

  return (
    <main className="app-main">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{t('billing.eyebrow')}</p>
          <h1>{t('billing.title')}</h1>
          <p>{t('billing.description')}</p>
        </div>
      </div>

      {checkout === 'success' ? <p className="checkout-banner checkout-banner-success">{t('billing.checkout.success')}</p> : null}
      {checkout === 'cancel' ? <p className="checkout-banner checkout-banner-cancel">{t('billing.checkout.cancel')}</p> : null}

      <section className="billing-summary" aria-label={t('billing.usage.title')}>
        <div className="billing-summary-status">
          <span className={`status-badge status-${entitlement.displayStatus}`}>{billingStatusLabel(locale, entitlement.displayStatus)}</span>
          {periodEndsAt ? (
            <span className="billing-summary-note">
              <CalendarClock size={15} aria-hidden="true" />
              {t(entitlement.displayStatus === 'trialing' ? 'billing.trialEndsAt' : 'billing.graceEndsAt', { date: dateFormat(periodEndsAt) })}
            </span>
          ) : null}
        </div>

        <div className="billing-usage">
          <div className="billing-usage-header"><Gauge size={16} aria-hidden="true" /><span>{t('billing.usage.title')}</span></div>
          <div className="usage-bar">
            <div
              className="usage-bar-fill"
              data-state={entitlement.overLimit ? 'over' : entitlement.usageWarning ? 'warning' : 'normal'}
              style={{ width: `${Math.min(100, entitlement.usagePercent)}%` }}
            />
          </div>
          <p className="billing-usage-count">
            {entitlement.monthlyOrderLimit === null
              ? t('billing.usage.unlimited', { count: entitlement.processedOrderCount })
              : t('billing.usage.limit', { count: entitlement.processedOrderCount, limit: entitlement.monthlyOrderLimit })}
          </p>
        </div>

        {entitlement.displayStatus === 'read_only' ? (
          <p className="billing-alert"><AlertTriangle size={16} aria-hidden="true" />{t('billing.readOnlyNotice')}</p>
        ) : entitlement.overLimit ? (
          <p className="billing-alert"><AlertTriangle size={16} aria-hidden="true" />{t('billing.usage.overLimit')}</p>
        ) : entitlement.usageWarning ? (
          <p className="billing-alert billing-alert-warning"><AlertTriangle size={16} aria-hidden="true" />{t('billing.usage.warning')}</p>
        ) : null}
      </section>

      <BillingPlans
        orgId={orgId}
        plans={catalog.plans}
        enterprise={catalog.enterprise}
        currentPlanCode={entitlement.planCode}
        isPaidActive={entitlement.displayStatus === 'active'}
      />
    </main>
  );
}
