import Link from 'next/link';
import { ArrowRight, Check, FileCheck2, PackageCheck, RefreshCcw, ShieldCheck, Truck } from 'lucide-react';
import { Brand } from '@/components/Brand';
import { PreferencesControls } from '@/components/PreferencesControls';
import { getTranslations } from '@/lib/server-i18n';

export default async function HomePage() {
  const { t } = await getTranslations();
  const workflow = [
    { icon: RefreshCcw, label: t('marketing.preview.refund'), source: 'Shopify', order: '#PT-4821', time: t('marketing.preview.minutesAgo', { minutes: 12 }), tone: 'danger' },
    { icon: Truck, label: t('marketing.preview.delivery'), source: 'CTT Expresso', order: '#PT-4798', time: t('marketing.preview.minutesAgo', { minutes: 38 }), tone: 'warning' },
    { icon: FileCheck2, label: t('marketing.preview.invoice'), source: 'InvoiceXpress', order: '#PT-4772', time: t('marketing.preview.hourAgo'), tone: 'neutral' },
  ];

  return (
    <main className="marketing-page">
      <header className="public-header">
        <div className="public-nav">
          <Brand />
          <nav aria-label={t('nav.primary')}>
            <a href="#produto">{t('nav.product')}</a>
            <a href="#controlo">{t('nav.control')}</a>
          </nav>
          <div className="public-actions">
            <PreferencesControls />
            <Link href="/sign-in" className="text-link">{t('nav.signIn')}</Link>
            <Link href="/exceptions" className="button button-compact">{t('nav.openApp')} <ArrowRight size={16} aria-hidden="true" /></Link>
          </div>
        </div>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-grid" aria-hidden="true" />
        <div className="hero-copy">
          <p className="eyebrow">{t('marketing.eyebrow')}</p>
          <h1 id="hero-title">{t('marketing.title')} <em>{t('marketing.titleAccent')}</em></h1>
          <p className="hero-lead">{t('marketing.lead')}</p>
          <div className="hero-actions">
            <Link href="/sign-up" className="button">{t('marketing.createAccount')} <ArrowRight size={18} aria-hidden="true" /></Link>
            <Link href="/sign-in" className="button button-secondary">{t('marketing.signIn')}</Link>
          </div>
        </div>

        <div className="product-preview" id="produto" aria-label={t('marketing.preview.label')}>
          <div className="preview-bar">
            <div><span className="preview-logo">R</span><strong>{t('marketing.preview.inbox')}</strong></div>
            <span className="preview-status"><span /> {t('marketing.preview.synced')}</span>
          </div>
          <div className="preview-summary">
            <div><span>{t('marketing.preview.pending')}</span><strong>08</strong></div>
            <div><span>{t('marketing.preview.protected')}</span><strong>€ 2.840</strong></div>
            <div className="preview-summary-note"><ShieldCheck size={20} aria-hidden="true" /><span>{t('marketing.preview.approval')}</span></div>
          </div>
          <div className="preview-list">
            {workflow.map(({ icon: Icon, label, source, order, time, tone }) => (
              <div className="preview-row" key={order}>
                <span className={`preview-icon ${tone}`}><Icon size={18} aria-hidden="true" /></span>
                <div><strong>{label}</strong><span>{source} · {order}</span></div>
                <time>{time}</time>
                <span className="preview-chevron" aria-hidden="true">›</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="trust-strip" aria-label={t('marketing.integrations')}>
        <span>{t('marketing.sources')}</span>
        <strong>Shopify</strong><strong>CTT</strong><strong>DPD</strong><strong>InvoiceXpress</strong><strong>Moloni</strong>
      </section>

      <section className="control-section" id="controlo">
        <div className="section-heading">
          <p className="eyebrow">{t('marketing.process.eyebrow')}</p>
          <h2>{t('marketing.process.title')}<br />{t('marketing.process.titleAccent')}</h2>
        </div>
        <div className="control-steps">
          <article><span>01</span><PackageCheck aria-hidden="true" /><h3>{t('marketing.process.detect')}</h3><p>{t('marketing.process.detectDescription')}</p></article>
          <article><span>02</span><ShieldCheck aria-hidden="true" /><h3>{t('marketing.process.decide')}</h3><p>{t('marketing.process.decideDescription')}</p></article>
          <article><span>03</span><Check aria-hidden="true" /><h3>{t('marketing.process.record')}</h3><p>{t('marketing.process.recordDescription')}</p></article>
        </div>
      </section>

      <footer className="marketing-footer">
        <Brand />
        <p>{t('marketing.footer')}</p>
        <Link href="/sign-up">{t('marketing.start')} <ArrowRight size={16} aria-hidden="true" /></Link>
      </footer>
    </main>
  );
}
