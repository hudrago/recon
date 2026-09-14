import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

interface SessionResponse {
  session: { activeOrganizationId?: string | null };
  user: { id: string; email: string; name: string };
}

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

export async function getSession(): Promise<SessionResponse | null> {
  const cookie = (await headers()).get('cookie');
  const response = await fetch(`${API_URL}/api/auth/get-session`, {
    headers: cookie ? { cookie } : undefined,
    cache: 'no-store',
  });
  if (!response.ok) return null;
  return response.json();
}

export async function requireActiveOrganization(): Promise<{ orgId: string; user: SessionResponse['user'] }> {
  const session = await getSession();
  if (!session) redirect('/sign-in');
  if (!session.session.activeOrganizationId) redirect('/onboarding');
  return { orgId: session.session.activeOrganizationId, user: session.user };
}