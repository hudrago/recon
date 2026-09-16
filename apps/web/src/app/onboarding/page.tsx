'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Building2 } from 'lucide-react';
import { AuthShell } from '@/components/AuthShell';
import { usePreferences } from '@/components/PreferencesProvider';
import { authClient } from '@/lib/auth-client';

export default function OnboardingPage() {
  const router = useRouter();
  const { t } = usePreferences();
  const [error, setError] = useState<string>();
  const [pendingAction, setPendingAction] = useState<string>();
  const { data: organizations, isPending: organizationsPending } = authClient.useListOrganizations();

  async function activate(organizationId: string) {
    if (pendingAction) return;
    setError(undefined);
    setPendingAction(organizationId);
    const result = await authClient.organization.setActive({ organizationId });
    if (result.error) {
      setError(result.error.message ?? t('onboarding.selectError'));
      setPendingAction(undefined);
      return;
    }
    router.push('/exceptions');
    router.refresh();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingAction) return;
    setError(undefined);
    setPendingAction('create');
    const form = new FormData(event.currentTarget);
    const name = String(form.get('organization'));
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${crypto.randomUUID().slice(0, 8)}`;
    const result = await authClient.organization.create({ name, slug });
    if (result.error || !result.data) {
      setError(result.error?.message ?? t('onboarding.createError'));
      setPendingAction(undefined);
      return;
    }
    await authClient.organization.setActive({ organizationId: result.data.id });
    router.push('/exceptions');
    router.refresh();
  }

  return (
    <AuthShell eyebrow={t('onboarding.eyebrow')} title={organizations && organizations.length > 0 ? t('onboarding.chooseTitle') : t('onboarding.createTitle')} description={organizations && organizations.length > 0 ? t('onboarding.chooseDescription') : t('onboarding.createDescription')}>
        {organizations && organizations.length > 0 ? (
            <div className="workspace-list">
              {organizations.map((organization) => (
                <button key={organization.id} className="workspace-option" type="button" disabled={Boolean(pendingAction)} onClick={() => void activate(organization.id)}>
                  <Building2 size={20} aria-hidden="true" /><span>{pendingAction === organization.id ? t('onboarding.opening') : organization.name}</span>
                </button>
              ))}
              {error ? <p className="form-error" role="alert">{error}</p> : null}
            </div>
        ) : organizationsPending ? (
          <p className="auth-description" role="status">{t('onboarding.loading')}</p>
        ) : (
            <form className="form-stack" onSubmit={submit}>
              <label className="field">{t('onboarding.organizationName')}<input name="organization" autoComplete="organization" required /></label>
              {error ? <p className="form-error" role="alert">{error}</p> : null}
              <button className="button form-button" type="submit" disabled={Boolean(pendingAction)}>{pendingAction ? t('onboarding.creating') : t('onboarding.create')}</button>
            </form>
        )}
    </AuthShell>
  );
}