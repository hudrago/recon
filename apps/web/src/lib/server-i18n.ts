import 'server-only';

import { cookies } from 'next/headers';
import { isLocale, translate } from './i18n';

export async function getLocale() {
  const value = (await cookies()).get('recon-locale')?.value;
  return isLocale(value) ? value : 'pt';
}

export async function getTranslations() {
  const locale = await getLocale();
  return { locale, t: translate.bind(null, locale) };
}