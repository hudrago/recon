'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Brand } from './Brand';
import { PreferencesControls } from './PreferencesControls';
import { usePreferences } from './PreferencesProvider';

export function PublicLegalShell({ eyebrow, title, updatedAt, children }: { eyebrow: string; title: string; updatedAt: string; children: ReactNode }) {
  const { locale } = usePreferences();
  const labels = locale === 'pt'
    ? { back: 'Voltar ao início', navigation: 'Navegação legal', privacy: 'Privacidade', security: 'Segurança', updated: 'Atualizado em' }
    : { back: 'Back to home', navigation: 'Legal navigation', privacy: 'Privacy', security: 'Security', updated: 'Updated' };

  return (
    <main className="legal-page">
      <header className="legal-header"><Brand /><PreferencesControls iconMenus /></header>
      <article className="legal-content">
        <Link href="/" className="back-link"><ArrowLeft size={17} aria-hidden="true" />{labels.back}</Link>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="legal-updated">{labels.updated}: {updatedAt}</p>
        <div className="legal-copy">{children}</div>
      </article>
      <footer className="legal-footer"><Brand /><nav aria-label={labels.navigation}><Link href="/privacy">{labels.privacy}</Link><Link href="/security">{labels.security}</Link><a href="mailto:ola@recon.pt">ola@recon.pt</a></nav></footer>
    </main>
  );
}