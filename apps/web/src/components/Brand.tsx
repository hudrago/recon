'use client';

import Link from 'next/link';
import { usePreferences } from './PreferencesProvider';

export function Brand({ compact = false }: { compact?: boolean }) {
  const { t } = usePreferences();
  return (
    <Link href="/" className="brand" aria-label={t('brand.home')}>
      <span className="brand-mark" aria-hidden="true">
        <span />
        <span />
      </span>
      <span className={compact ? 'sr-only sm:not-sr-only' : undefined}>Recon</span>
    </Link>
  );
}