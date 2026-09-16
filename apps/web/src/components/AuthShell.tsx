'use client';

import type { ReactNode } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Brand } from './Brand';
import { PreferencesControls } from './PreferencesControls';
import { usePreferences } from './PreferencesProvider';

export function AuthShell({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  const { t } = usePreferences();
  const benefits = [t('auth.benefit.exceptions'), t('auth.benefit.approval'), t('auth.benefit.audit')];

  return (
    <main className="auth-shell">
      <aside className="auth-context" aria-label={t('auth.benefitsLabel')}>
        <Brand />
        <div>
          <p className="eyebrow eyebrow-light">{t('auth.contextEyebrow')}</p>
          <h2>{t('auth.contextTitle')}</h2>
          <ul>
            {benefits.map((benefit) => (
              <li key={benefit}><CheckCircle2 aria-hidden="true" size={18} />{benefit}</li>
            ))}
          </ul>
        </div>
        <p className="auth-context-note">{t('auth.contextNote')}</p>
      </aside>
      <section className="auth-panel">
        <PreferencesControls className="auth-preferences" iconMenus />
        <div className="auth-mobile-brand"><Brand /></div>
        <div className="auth-form-wrap">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="auth-description">{description}</p>
          {children}
        </div>
      </section>
    </main>
  );
}