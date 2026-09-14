'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { authClient } from '@/lib/auth-client';

export default function SignUpPage() {
  const router = useRouter();
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const form = new FormData(event.currentTarget);
    const result = await authClient.signUp.email({
      name: String(form.get('name')),
      email: String(form.get('email')),
      password: String(form.get('password')),
    });
    if (result.error) return setError(result.error.message ?? 'Unable to create account');
    router.push('/onboarding');
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-text-primary">
      <section className="w-full max-w-sm">
        <p className="mb-2 text-sm font-semibold text-accent">Recon</p>
        <h1 className="mb-8 text-3xl font-bold">Create your account</h1>
        <form className="flex flex-col gap-4" onSubmit={submit}>
          <label className="text-sm text-text-secondary">Name<input className="mt-2 w-full rounded-md border border-border bg-surface px-3 py-3 text-text-primary" name="name" required /></label>
          <label className="text-sm text-text-secondary">Email<input className="mt-2 w-full rounded-md border border-border bg-surface px-3 py-3 text-text-primary" name="email" type="email" required /></label>
          <label className="text-sm text-text-secondary">Password<input className="mt-2 w-full rounded-md border border-border bg-surface px-3 py-3 text-text-primary" name="password" type="password" required minLength={8} /></label>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <button className="rounded-md bg-accent px-4 py-3 font-semibold text-background" type="submit">Create account</button>
        </form>
        <p className="mt-6 text-sm text-text-secondary">Already have an account? <Link className="text-accent" href="/sign-in">Sign in</Link></p>
      </section>
    </main>
  );
}