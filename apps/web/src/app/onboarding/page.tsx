'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { authClient } from '@/lib/auth-client';

export default function OnboardingPage() {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const { data: organizations, isPending: organizationsPending } = authClient.useListOrganizations();

  async function activate(organizationId: string) {
    setError(undefined);
    const result = await authClient.organization.setActive({ organizationId });
    if (result.error) return setError(result.error.message ?? 'Unable to select organization');
    router.push('/');
    router.refresh();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const form = new FormData(event.currentTarget);
    const name = String(form.get('organization'));
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${crypto.randomUUID().slice(0, 8)}`;
    const result = await authClient.organization.create({ name, slug });
    if (result.error || !result.data) return setError(result.error?.message ?? 'Unable to create organization');
    await authClient.organization.setActive({ organizationId: result.data.id });
    router.push('/');
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-text-primary">
      <section className="w-full max-w-sm">
        <p className="mb-2 text-sm font-semibold text-accent">Recon</p>
        {organizations && organizations.length > 0 ? (
          <>
            <h1 className="mb-3 text-3xl font-bold">Choose your workspace</h1>
            <p className="mb-8 text-sm text-text-secondary">Continue with an organization you already belong to.</p>
            <div className="flex flex-col gap-3">
              {organizations.map((organization) => (
                <button key={organization.id} className="rounded-md bg-accent px-4 py-3 font-semibold text-background" type="button" onClick={() => void activate(organization.id)}>
                  Continue to {organization.name}
                </button>
              ))}
              {error ? <p className="text-sm text-danger">{error}</p> : null}
            </div>
          </>
        ) : organizationsPending ? (
          <p className="text-sm text-text-secondary">Loading workspaces...</p>
        ) : (
          <>
            <h1 className="mb-3 text-3xl font-bold">Create your workspace</h1>
            <p className="mb-8 text-sm text-text-secondary">This keeps your exceptions, actions, and integrations isolated from every other organization.</p>
            <form className="flex flex-col gap-4" onSubmit={submit}>
              <label className="text-sm text-text-secondary">Organization name<input className="mt-2 w-full rounded-md border border-border bg-surface px-3 py-3 text-text-primary" name="organization" required /></label>
              {error ? <p className="text-sm text-danger">{error}</p> : null}
              <button className="rounded-md bg-accent px-4 py-3 font-semibold text-background" type="submit">Create workspace</button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}