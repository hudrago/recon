'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { AuthShell } from '@/components/AuthShell';
import { usePreferences } from '@/components/PreferencesProvider';
import { authClient } from '@/lib/auth-client';

export default function SignInPage() {
  const router = useRouter();
  const { t } = usePreferences();
  const [error, setError] = useState<string>();
  const [isPending, setIsPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;
    setError(undefined);
    setIsPending(true);
    const form = new FormData(event.currentTarget);
    const result = await authClient.signIn.email({
      email: String(form.get('email')),
      password: String(form.get('password')),
    });
    if (result.error) {
      setError(result.error.message ?? t('signIn.error'));
      setIsPending(false);
      return;
    }
    router.push('/exceptions');
    router.refresh();
  }

  return (
    <AuthShell eyebrow={t('signIn.eyebrow')} title={t('signIn.title')} description={t('signIn.description')}>
        <form className="form-stack" onSubmit={submit}>
          <label className="field">
            {t('signIn.email')}
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label className="field">
            {t('signIn.password')}
            <input name="password" type="password" autoComplete="current-password" required minLength={8} />
          </label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button className="button form-button" type="submit" disabled={isPending}>
            {isPending ? t('signIn.pending') : t('signIn.submit')}
          </button>
        </form>
        <p className="auth-switch">
          {t('signIn.noAccount')} <Link href="/sign-up">{t('signIn.createAccount')}</Link>
        </p>
    </AuthShell>
  );
}