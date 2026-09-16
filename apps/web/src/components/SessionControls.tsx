'use client';

import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';

export function SessionControls() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const { data: organizations } = authClient.useListOrganizations();
  if (!session) return null;

  async function switchOrganization(organizationId: string) {
    await authClient.organization.setActive({ organizationId });
    router.push('/');
    router.refresh();
  }

  async function signOut() {
    await authClient.signOut();
    router.push('/sign-in');
    router.refresh();
  }

  return (
    <header className="flex items-center justify-end gap-3 border-b border-border bg-surface px-8 py-3 text-sm text-text-secondary sm:px-12">
      {organizations && organizations.length > 0 ? (
        <select
          aria-label="Organization"
          className="rounded-md border border-border bg-background px-3 py-2 text-text-primary"
          value={session.session.activeOrganizationId ?? ''}
          onChange={(event) => void switchOrganization(event.target.value)}
        >
          {!session.session.activeOrganizationId ? <option value="" disabled>Select workspace</option> : null}
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>
              {organization.name}
            </option>
          ))}
        </select>
      ) : null}
      <span>{session.user.email}</span>
      <button className="rounded-md border border-border px-3 py-2 text-text-primary hover:border-accent" onClick={() => void signOut()}>
        Sign out
      </button>
    </header>
  );
}