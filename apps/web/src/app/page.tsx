import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  PackageSearch,
  ReceiptText,
  RefreshCcw,
  ShieldCheck,
  Truck,
  UserRoundCheck,
  Zap,
} from 'lucide-react';
import { Brand } from '@/components/Brand';
import { PreferencesControls } from '@/components/PreferencesControls';
import { getTranslations } from '@/lib/server-i18n';

export default async function HomePage() {
  const { t } = await getTranslations();
  const exceptions = [
    { icon: RefreshCcw, label: t('marketing.preview.refund'), source: 'Shopify', order: '#PT-4821', amount: '€ 89,90', time: t('marketing.preview.minutesAgo', { minutes: 12 }), tone: 'critical' },
    { icon: Truck, label: t('marketing.preview.delivery'), source: 'CTT Expresso', order: '#PT-4798', amount: '72 h', time: t('marketing.preview.minutesAgo', { minutes: 38 }), tone: 'warning' },
    { icon: FileCheck2, label: t('marketing.preview.invoice'), source: 'InvoiceXpress', order: '#PT-4772', amount: '€ 142,00', time: t('marketing.preview.hourAgo'), tone: 'neutral' },
  ];
  const valueProps = [
    { icon: CircleDollarSign, title: t('marketing.value.refunds'), description: t('marketing.value.refundsDescription') },
    { icon: Truck, title: t('marketing.value.deliveries'), description: t('marketing.value.deliveriesDescription') },
    { icon: ReceiptText, title: t('marketing.value.invoicing'), description: t('marketing.value.invoicingDescription') },
  ];
  const workflow = [
    { icon: PackageSearch, title: t('marketing.process.detect'), description: t('marketing.process.detectDescription') },
    { icon: UserRoundCheck, title: t('marketing.process.decide'), description: t('marketing.process.decideDescription') },
    { icon: Zap, title: t('marketing.process.execute'), description: t('marketing.process.executeDescription') },
  ];

  return (
    <main className="marketing-page">
      <header className="public-header">
        <div className="public-nav">
          <Brand />
          <nav aria-label={t('nav.primary')}>
            <a href="#produto">{t('nav.product')}</a>
            <a href="#integracoes">{t('nav.integrations')}</a>
            <a href="#seguranca">{t('nav.security')}</a>
          </nav>
          <div className="public-actions">
            <PreferencesControls iconMenus />
            <Link href="/sign-in" className="text-link">{t('nav.signIn')}</Link>
            <Link href="/sign-up" className="button button-compact">{t('nav.getStarted')} <ArrowUpRight size={15} aria-hidden="true" /></Link>
          </div>
        </div>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">{t('marketing.eyebrow')}</p>
          <h1 id="hero-title"><span>{t('marketing.title')}</span> <em>{t('marketing.titleAccent')}</em></h1>
          <p className="hero-lead">{t('marketing.lead')}</p>
          <div className="hero-actions">
            <Link href="/sign-up" className="button">{t('marketing.createAccount')} <ArrowRight size={18} aria-hidden="true" /></Link>
            <a href="#produto" className="hero-text-link">{t('marketing.seeProduct')} <ArrowUpRight size={16} aria-hidden="true" /></a>
          </div>
          <p className="hero-proof"><Check size={14} aria-hidden="true" /> {t('marketing.proof')}</p>
        </div>

        <div className="product-stage" id="produto">
          <div className="product-preview" aria-label={t('marketing.preview.label')}>
            <div className="preview-sidebar" aria-hidden="true">
              <span className="preview-logo">R</span>
              <span className="preview-nav-item active"><PackageSearch size={17} /></span>
              <span className="preview-nav-item"><Clock3 size={17} /></span>
              <span className="preview-nav-item"><ShieldCheck size={17} /></span>
            </div>
            <div className="preview-main">
              <div className="preview-bar">
                <div><span>{t('marketing.preview.workspace')}</span><strong>{t('marketing.preview.inbox')}</strong></div>
                <span className="preview-status"><span /> {t('marketing.preview.synced')}</span>
              </div>
              <div className="preview-summary">
                <div><span>{t('marketing.preview.pending')}</span><strong>08</strong></div>
                <div><span>{t('marketing.preview.approved')}</span><strong>24</strong></div>
                <div><span>{t('marketing.preview.protected')}</span><strong>€ 2.840</strong></div>
              </div>
              <div className="preview-table-head" aria-hidden="true">
                <span>{t('marketing.preview.exception')}</span><span>{t('marketing.preview.impact')}</span><span>{t('marketing.preview.detected')}</span>
              </div>
              <div className="preview-list">
                {exceptions.map(({ icon: Icon, label, source, order, amount, time, tone }) => (
                  <div className="preview-row" key={order}>
                    <span className={`preview-icon ${tone}`}><Icon size={17} aria-hidden="true" /></span>
                    <div className="preview-identity"><strong>{label}</strong><span>{source} · {order}</span></div>
                    <strong className="preview-amount">{amount}</strong>
                    <time>{time}</time>
                    <ArrowUpRight className="preview-chevron" size={15} aria-hidden="true" />
                  </div>
                ))}
              </div>
              <div className="preview-foot"><ShieldCheck size={14} aria-hidden="true" /> {t('marketing.preview.approval')}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="trust-strip" id="integracoes" aria-label={t('marketing.integrations')}>
        <span>{t('marketing.sources')}</span>
        <div className="integration-list"><strong>Shopify</strong><i /><strong>CTT</strong><i /><strong>DPD</strong><i /><strong>InvoiceXpress</strong><i /><strong>Moloni</strong></div>
      </section>

      <section className="value-band" aria-labelledby="value-title">
        <h2 id="value-title" className="sr-only">{t('marketing.value.title')}</h2>
        <div className="value-grid">
          {valueProps.map(({ icon: Icon, title, description }) => (
            <article key={title}><Icon aria-hidden="true" /><div><h3>{title}</h3><p>{description}</p></div><ArrowUpRight size={18} aria-hidden="true" /></article>
          ))}
        </div>
      </section>

      <section className="control-section" id="seguranca" aria-labelledby="control-title">
        <div className="section-heading">
          <p className="eyebrow">{t('marketing.process.eyebrow')}</p>
          <h2 id="control-title"><span>{t('marketing.process.title')}</span> <em>{t('marketing.process.titleAccent')}</em></h2>
          <p>{t('marketing.process.intro')}</p>
        </div>
        <div className="control-steps">
          {workflow.map(({ icon: Icon, title, description }, index) => (
            <article key={title}><div className="step-marker"><span>0{index + 1}</span><Icon size={20} aria-hidden="true" /></div><h3>{title}</h3><p>{description}</p></article>
          ))}
        </div>
      </section>

      <section className="marketing-cta" aria-labelledby="cta-title">
        <div><p className="eyebrow">{t('marketing.cta.eyebrow')}</p><h2 id="cta-title">{t('marketing.cta.title')}</h2></div>
        <Link href="/sign-up" className="button">{t('marketing.start')} <ArrowRight size={18} aria-hidden="true" /></Link>
      </section>

      <footer className="marketing-footer">
        <Brand />
        <nav aria-label={t('marketing.footerNavigation')}><a href="#seguranca">{t('marketing.security')}</a><a href="mailto:ola@recon.pt">ola@recon.pt</a></nav>
        <p>© 2026 Recon. {t('marketing.rights')}</p>
      </footer>
    </main>
  );
}
