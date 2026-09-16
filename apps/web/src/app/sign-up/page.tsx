'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { AuthShell } from '@/components/AuthShell';
import { usePreferences } from '@/components/PreferencesProvider';
import { authClient } from '@/lib/auth-client';

export default function SignUpPage() {
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
    const result = await authClient.signUp.email({
      name: String(form.get('name')),
      email: String(form.get('email')),
      password: String(form.get('password')),
    });
    if (result.error) {
      setError(result.error.message ?? t('signUp.error'));
      setIsPending(false);
      return;
    }
    router.push('/onboarding');
    router.refresh();
  }

  return (
    <AuthShell eyebrow={t('signUp.eyebrow')} title={t('signUp.title')} description={t('signUp.description')}>
        <form className="form-stack" onSubmit={submit}>
          <label className="field">{t('signUp.name')}<input name="name" autoComplete="name" required /></label>
          <label className="field">{t('signUp.email')}<input name="email" type="email" autoComplete="email" required /></label>
          <label className="field">{t('signUp.password')}<input name="password" type="password" autoComplete="new-password" required minLength={8} /></label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button className="button form-button" type="submit" disabled={isPending}>{isPending ? t('signUp.pending') : t('signUp.submit')}</button>
        </form>
        <p className="auth-switch">{t('signUp.hasAccount')} <Link href="/sign-in">{t('signUp.signIn')}</Link></p>
    </AuthShell>
  );
}