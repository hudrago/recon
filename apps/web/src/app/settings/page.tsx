import { redirect } from 'next/navigation';
import { getTranslations } from '@/lib/server-i18n';
import { getSession } from '@/lib/session';
import { DeletionSettings } from './DeletionSettings';

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect('/sign-in');
  const { t } = await getTranslations();
  return <main className="app-main"><div className="page-heading"><div><p className="eyebrow">{t('settings.eyebrow')}</p><h1>{t('settings.title')}</h1><p>{t('settings.description')}</p></div></div><DeletionSettings orgId={session.session.activeOrganizationId ?? null} email={session.user.email} /></main>;
}