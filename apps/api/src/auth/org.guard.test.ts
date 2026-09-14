import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedRequest, AuthSessionProvider, MembershipStore } from './auth.types';
import { OrgGuard } from './org.guard';

function createContext(request: AuthenticatedRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('OrgGuard', () => {
  const session = { user: { id: 'user_1', email: 'operator@example.com' } };

  it('rejects a request without a valid session', async () => {
    const sessions: AuthSessionProvider = { getSession: vi.fn().mockResolvedValue(null) };
    const memberships: MembershipStore = { getRole: vi.fn() };
    const guard = new OrgGuard(sessions, memberships);

    await expect(guard.canActivate(createContext({ headers: {}, params: { orgId: 'org_1' } }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(memberships.getRole).not.toHaveBeenCalled();
  });

  it('rejects an authenticated user who is not a member of the requested organization', async () => {
    const sessions: AuthSessionProvider = { getSession: vi.fn().mockResolvedValue(session) };
    const memberships: MembershipStore = { getRole: vi.fn().mockResolvedValue(null) };
    const guard = new OrgGuard(sessions, memberships);

    await expect(guard.canActivate(createContext({ headers: {}, params: { orgId: 'org_2' } }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('attaches trusted user and membership data for an organization member', async () => {
    const request: AuthenticatedRequest = { headers: {}, params: { orgId: 'org_1' } };
    const sessions: AuthSessionProvider = { getSession: vi.fn().mockResolvedValue(session) };
    const memberships: MembershipStore = { getRole: vi.fn().mockResolvedValue('operator') };
    const guard = new OrgGuard(sessions, memberships);

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(request.auth).toEqual({ ...session, orgId: 'org_1', role: 'operator' });
  });
});