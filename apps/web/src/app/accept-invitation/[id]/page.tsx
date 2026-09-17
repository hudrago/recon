import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { getTranslations } from '@/lib/server-i18n';
import { getSession } from '@/lib/session';
import { AcceptInvitationAction } from './AcceptInvitationAction';

export default async function AcceptInvitationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const { t } = await getTranslations();

  return (
    <main className="app-main case-main">
      <section className="decision-panel" aria-labelledby="invite-title">
        <ShieldCheck aria-hidden="true" />
        <p className="eyebrow">{t('acceptInvitation.eyebrow')}</p>
        <h2 id="invite-title">{t('acceptInvitation.title')}</h2>
        {session ? (
          <AcceptInvitationAction invitationId={id} />
        ) : (
          <>
            <p className="decision-intro">{t('acceptInvitation.signInPrompt')}</p>
            <div className="decision-actions">
              <Link className="button" href="/sign-in">{t('acceptInvitation.signIn')}</Link>
              <Link className="button button-secondary" href="/sign-up">{t('acceptInvitation.signUp')}</Link>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
