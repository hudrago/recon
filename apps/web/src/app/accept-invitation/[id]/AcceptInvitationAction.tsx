'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { usePreferences } from '@/components/PreferencesProvider';

export function AcceptInvitationAction({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const { t } = usePreferences();
  const [pending, setPending] = useState<'accept' | 'decline' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [declined, setDeclined] = useState(false);

  async function accept() {
    setPending('accept');
    setError(null);
    const result = await authClient.organization.acceptInvitation({ invitationId });
    setPending(null);
    if (result.error) {
      setError(result.error.message ?? t('acceptInvitation.error'));
      return;
    }
    router.push('/exceptions');
    router.refresh();
  }

  async function decline() {
    setPending('decline');
    setError(null);
    const result = await authClient.organization.rejectInvitation({ invitationId });
    setPending(null);
    if (result.error) {
      setError(result.error.message ?? t('acceptInvitation.error'));
      return;
    }
    setDeclined(true);
  }

  if (declined) return <p className="decision-intro">{t('acceptInvitation.declined')}</p>;

  return (
    <>
      <p className="decision-intro">{t('acceptInvitation.description')}</p>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <div className="decision-actions">
        <button type="button" className="button" disabled={pending !== null} onClick={accept}>
          <Check size={17} aria-hidden="true" /> {pending === 'accept' ? t('common.processing') : t('acceptInvitation.accept')}
        </button>
        <button type="button" className="button button-secondary" disabled={pending !== null} onClick={decline}>
          <X size={17} aria-hidden="true" /> {pending === 'decline' ? t('common.processing') : t('acceptInvitation.decline')}
        </button>
      </div>
    </>
  );
}
