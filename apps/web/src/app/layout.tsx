import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import '@fontsource-variable/manrope';
import '@fontsource-variable/newsreader';
import { PreferencesProvider } from '@/components/PreferencesProvider';
import { SessionControls } from '@/components/SessionControls';
import { isLocale } from '@/lib/i18n';
import { getTranslations } from '@/lib/server-i18n';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();
  return { title: t('metadata.title'), description: t('metadata.description') };
}

const themeScript = `(function(){try{var t=localStorage.getItem('recon-theme')||'system';var d=t==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t;document.documentElement.dataset.theme=d}catch(e){}})()`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get('recon-locale')?.value;
  const locale = isLocale(localeCookie) ? localeCookie : 'pt';
  const themeCookie = cookieStore.get('recon-theme')?.value;
  const initialTheme = themeCookie === 'light' || themeCookie === 'dark' || themeCookie === 'system' ? themeCookie : 'system';

  return (
    <html lang={locale === 'pt' ? 'pt-PT' : 'en'} data-theme={initialTheme === 'system' ? undefined : initialTheme} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>
        <PreferencesProvider locale={locale} initialTheme={initialTheme}>
          <SessionControls />
          {children}
        </PreferencesProvider>
      </body>
    </html>
  );
}
