'use client';

import { Languages, SunMoon } from 'lucide-react';
import { locales, type Locale } from '@/lib/i18n';
import { usePreferences } from './PreferencesProvider';

export function PreferencesControls({ className = '' }: { className?: string }) {
  const { locale, setLocale, setTheme, t, theme } = usePreferences();

  return (
    <div className={`preference-controls ${className}`.trim()}>
      <label className="preference-field">
        <Languages size={16} aria-hidden="true" />
        <span className="sr-only">{t('preferences.language')}</span>
        <select value={locale} onChange={(event) => setLocale(event.target.value as Locale)} aria-label={t('preferences.language')}>
          {locales.map((option) => <option key={option} value={option}>{t(`preferences.locale.${option}`)}</option>)}
        </select>
      </label>
      <label className="preference-field">
        <SunMoon size={16} aria-hidden="true" />
        <span className="sr-only">{t('preferences.theme')}</span>
        <select value={theme} onChange={(event) => setTheme(event.target.value as 'system' | 'light' | 'dark')} aria-label={t('preferences.theme')}>
          <option value="system">{t('preferences.theme.system')}</option>
          <option value="light">{t('preferences.theme.light')}</option>
          <option value="dark">{t('preferences.theme.dark')}</option>
        </select>
      </label>
    </div>
  );
}