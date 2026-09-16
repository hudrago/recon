import Link from 'next/link';
import { AlertCircle, ArrowRight, CheckCircle2, CircleDashed } from 'lucide-react';
import { DEFAULT_SEVERITY_BY_CODE } from '@recon/ui';
import { listExceptions } from '@/lib/api';
import { encodeExceptionRouteId } from '@/lib/exception-route';
import { exceptionDescription, exceptionLabel, severityLabel, statusLabel } from '@/lib/presentation';
import { getTranslations } from '@/lib/server-i18n';
import { requireActiveOrganization } from '@/lib/session';

export default async function ExceptionsPage() {
  const { orgId } = await requireActiveOrganization();
  const { locale, t } = await getTranslations();
  const exceptions = await listExceptions(orgId);
  const openCount = exceptions.filter((exception) => exception.status === 'open').length;
  const approvedCount = exceptions.filter((exception) => exception.status === 'approved').length;

  return (
    <main className="app-main">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{t('inbox.eyebrow')}</p>
          <h1>{t('inbox.title')}</h1>
          <p>{t('inbox.description')}</p>
        </div>
        <div className="inbox-stats" aria-label={t('inbox.summary')}>
          <div><CircleDashed size={18} aria-hidden="true" /><span>{t('inbox.pending')}</span><strong>{openCount}</strong></div>
          <div><CheckCircle2 size={18} aria-hidden="true" /><span>{t('inbox.approved')}</span><strong>{approvedCount}</strong></div>
        </div>
      </div>
      {exceptions.length === 0 ? (
        <div className="empty-state">
          <CheckCircle2 size={28} aria-hidden="true" />
          <h2>{t('inbox.emptyTitle')}</h2>
          <p>{t('inbox.emptyDescription')}</p>
        </div>
      ) : (
        <section className="inbox-list" aria-label={t('inbox.list')}>
          <div className="inbox-list-header"><span>{t('inbox.column.exception')}</span><span>{t('inbox.column.status')}</span><span>{t('inbox.column.detected')}</span><span /></div>
          {exceptions.map((exception) => {
            const severity = DEFAULT_SEVERITY_BY_CODE[exception.code] ?? 'LOW';
            return (
              <Link
                key={exception.id}
                href={`/exceptions/${encodeExceptionRouteId(exception.id)}`}
                className="inbox-row"
              >
                <div className="exception-identity">
                  <span className={`severity-dot severity-${severity.toLowerCase()}`}><AlertCircle size={17} aria-hidden="true" /></span>
                  <div>
                    <strong>{exceptionLabel(locale, exception.code)}</strong>
                    <span>{exception.orderId} · {t('inbox.priority', { severity: severityLabel(locale, severity) })}</span>
                    <p>{exceptionDescription(locale, exception.code)}</p>
                  </div>
                </div>
                <span className={`status-badge status-${exception.status}`}>{statusLabel(locale, exception.status)}</span>
                <time dateTime={exception.detectedAt}>{new Date(exception.detectedAt).toLocaleString(locale === 'pt' ? 'pt-PT' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</time>
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            );
          })}
        </section>
      )}
    </main>
  );
}