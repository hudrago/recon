import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import {
  AUTH_SESSION_PROVIDER,
  type AuthenticatedRequest,
  type AuthSessionProvider,
  MEMBERSHIP_STORE,
  type MembershipStore,
} from './auth.types';

@Injectable()
export class OrgGuard implements CanActivate {
  constructor(
    @Inject(AUTH_SESSION_PROVIDER) private readonly sessions: AuthSessionProvider,
    @Inject(MEMBERSHIP_STORE) private readonly memberships: MembershipStore,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const session = await this.sessions.getSession(request.headers);
    if (!session) throw new UnauthorizedException();

    const orgId = request.params.orgId;
    if (!orgId) throw new ForbiddenException();

    const role = await this.memberships.getRole(session.user.id, orgId);
    if (!role) throw new ForbiddenException();

    request.auth = { ...session, orgId, role };
    return true;
  }
}