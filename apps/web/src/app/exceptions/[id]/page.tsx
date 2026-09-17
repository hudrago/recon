import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Clock3, FileSearch, ShoppingBag } from 'lucide-react';
import { getException, getExceptionAudit } from "@/lib/api";
import { decodeExceptionRouteId } from "@/lib/exception-route";
import {
  exceptionDescription,
  exceptionLabel,
  readableContextKey,
  statusLabel,
} from "@/lib/presentation";
import { getTranslations } from "@/lib/server-i18n";
import { requireActiveOrganization } from "@/lib/session";
import { CaseActions } from "./CaseActions";
import { CaseTimeline } from "./CaseTimeline";

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: routeId } = await params;
  const id = decodeExceptionRouteId(routeId);
  const { orgId } = await requireActiveOrganization();
  const { locale, t } = await getTranslations();
  const exception = await getException(orgId, id);
  if (!exception) notFound();
  const audit = await getExceptionAudit(orgId, exception.id);

  return (
    <main className="app-main case-main">
      <Link href="/exceptions" className="back-link">
        <ArrowLeft size={16} aria-hidden="true" /> {t("case.back")}
      </Link>
      <div className="case-heading">
        <div>
          <span className={`status-badge status-${exception.status}`}>
            {statusLabel(locale, exception.status)}
          </span>
          <h1>{exceptionLabel(locale, exception.code)}</h1>
          <p>
            {exceptionDescription(locale, exception.code) ||
              t("case.fallbackDescription")}
          </p>
        </div>
        <div className="case-order">
          <ShoppingBag size={18} aria-hidden="true" />
          <span>{t("case.order")}</span>
          <strong>{exception.orderId}</strong>
        </div>
      </div>

      <div className="case-grid">
        <section className="case-panel" aria-labelledby="context-title">
          <div className="case-panel-title">
            <FileSearch size={18} aria-hidden="true" />
            <h2 id="context-title">{t("case.context")}</h2>
          </div>
          <dl className="context-list">
            {Object.entries(exception.context).map(([key, value]) => (
              <div key={key}>
                <dt>{readableContextKey(key, locale)}</dt>
                <dd>
                  {typeof value === "object"
                    ? JSON.stringify(value)
                    : String(value)}
                </dd>
              </div>
            ))}
          </dl>
          <div className="detected-at">
            <Clock3 size={16} aria-hidden="true" />
            <span>
              {t("case.detectedAt", {
                date: new Date(exception.detectedAt).toLocaleString(
                  locale === "pt" ? "pt-PT" : "en-GB",
                  { dateStyle: "long", timeStyle: "short" },
                ),
              })}
            </span>
          </div>
        </section>
        <CaseActions
          orgId={orgId}
          exceptionId={exception.id}
          orderId={exception.orderId}
          status={exception.status}
          code={exception.code}
        />
      </div>

      <CaseTimeline
        entries={audit}
        locale={locale}
        title={t("case.timeline")}
        emptyLabel={t("case.timelineEmpty")}
      />
    </main>
  );
}
