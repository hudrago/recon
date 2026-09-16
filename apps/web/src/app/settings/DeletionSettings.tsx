'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Building2, UserRoundX } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { usePreferences } from '@/components/PreferencesProvider';
import { deleteOrganization } from './actions';

export function DeletionSettings({ orgId, email }: { orgId: string | null; email: string }) {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const { data: organization } = authClient.useActiveOrganization();
  const { t } = usePreferences();
  const [dialog, setDialog] = useState<'account' | 'organization' | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const organizationName = organization?.name ?? orgId;
  const organizationSlug = organization?.slug ?? '';
  const isOwner = organization?.members?.some((member) => member.userId === session?.user.id && member.role.split(',').map((role) => role.trim()).includes('owner')) ?? false;

  function openDialog(next: 'account' | 'organization') {
    setError(undefined);
    setDialog(next);
  }

  async function submitAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(undefined);
    const password = String(new FormData(event.currentTarget).get('password'));
    const result = await authClient.deleteUser({ password });
    if (result.error) {
      setError(result.error.message ?? t('settings.error'));
      setPending(false);
      return;
    }
    router.push('/');
    router.refresh();
  }

  async function submitOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(undefined);
    if (!orgId) return;
    const confirmation = String(new FormData(event.currentTarget).get('confirmation'));
    const result = await deleteOrganization(orgId, confirmation);
    if (result.error) {
      setError(result.error === 'ORGANIZATION_RETENTION_REQUIRED' ? t('settings.organization.retention') : t('settings.error'));
      setPending(false);
      return;
    }
    await authClient.organization.setActive({ organizationId: null });
    router.push('/onboarding');
    router.refresh();
  }

  return (
    <section className="danger-zone" aria-labelledby="danger-title">
      <div><p className="eyebrow">{t('settings.danger.eyebrow')}</p><h2 id="danger-title">{t('settings.danger.title')}</h2><p>{t('settings.danger.description')}</p></div>
      <div className="danger-action"><UserRoundX aria-hidden="true" /><div><strong>{t('settings.account.title')}</strong><span>{email}</span><p>{t('settings.account.description')}</p></div><button className="button button-danger" onClick={() => openDialog('account')}>{t('settings.account.delete')}</button></div>
      {orgId ? <div className="danger-action"><Building2 aria-hidden="true" /><div><strong>{t('settings.organization.title')}</strong><span>{organizationName}</span><p>{isOwner ? t('settings.organization.description') : t('settings.organization.ownerOnly')}</p></div>{isOwner ? <button className="button button-danger" onClick={() => openDialog('organization')}>{t('settings.organization.delete')}</button> : null}</div> : null}

      {dialog ? <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) setDialog(null); }}><div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="deletion-title"><AlertTriangle size={28} aria-hidden="true" /><h2 id="deletion-title">{dialog === 'account' ? t('settings.account.confirmTitle') : t('settings.organization.confirmTitle')}</h2><p>{dialog === 'account' ? t('settings.account.confirmDescription') : t('settings.organization.confirmDescription', { slug: organizationSlug })}</p><form onSubmit={dialog === 'account' ? submitAccount : submitOrganization}><label className="field"><span>{dialog === 'account' ? t('settings.account.password') : organizationSlug}</span><input name={dialog === 'account' ? 'password' : 'confirmation'} type={dialog === 'account' ? 'password' : 'text'} required autoComplete={dialog === 'account' ? 'current-password' : 'off'} /></label>{error ? <p className="form-error" role="alert">{error}</p> : null}<div className="dialog-actions"><button type="button" className="button button-secondary" disabled={pending} onClick={() => setDialog(null)} autoFocus>{t('common.cancel')}</button><button type="submit" className="button button-danger" disabled={pending}>{pending ? t('common.processing') : t('settings.confirmDelete')}</button></div></form></div></div> : null}
    </section>
  );
}