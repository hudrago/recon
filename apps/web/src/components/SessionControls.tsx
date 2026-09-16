'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
import { Building2, LogOut } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { Brand } from './Brand';
import { HeaderSelectMenu } from './HeaderSelectMenu';
import { PreferencesControls } from './PreferencesControls';
import { usePreferences } from './PreferencesProvider';

export function SessionControls() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = authClient.useSession();
  const { data: organizations } = authClient.useListOrganizations();
  const { t } = usePreferences();

  if (!session || !pathname.startsWith('/exceptions')) return null;

  async function switchOrganization(organizationId: string) {
    await authClient.organization.setActive({ organizationId });
    router.push('/exceptions');
    router.refresh();
  }

  async function signOut() {
    await authClient.signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <Brand compact />
        <nav aria-label={t('session.navigation')}><Link href="/exceptions" aria-current="page">{t('session.exceptions')}</Link></nav>
        <div className="session-actions">
          <PreferencesControls />
          {organizations && organizations.length > 0 ? (
            <label className="organization-picker" title={t('session.activeOrganization')}>
              <Building2 size={18} aria-hidden="true" />
              <select aria-label={t('session.activeOrganization')} value={session.session.activeOrganizationId ?? ''} onChange={(event) => void switchOrganization(event.target.value)}>
                {!session.session.activeOrganizationId ? <option value="" disabled>{t('session.selectOrganization')}</option> : null}
                {organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
              </select>
            </label>
          ) : null}
          <div className="mobile-session-menus">
            <PreferencesControls iconMenus />
            {organizations && organizations.length > 0 ? (
              <HeaderSelectMenu label={t('session.activeOrganization')} icon={<Building2 size={18} aria-hidden="true" />} value={session.session.activeOrganizationId ?? ''} options={organizations.map((organization) => ({ value: organization.id, label: organization.name }))} onSelect={(organizationId) => void switchOrganization(organizationId)} />
            ) : null}
          </div>
          <span className="session-email">{session.user.email}</span>
          <button className="icon-button" onClick={() => void signOut()} aria-label={t('session.signOut')} title={t('session.signOut')}>
            <LogOut size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}