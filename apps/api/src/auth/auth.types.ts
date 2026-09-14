import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http';

export interface AuthSession {
  user: {
    id: string;
    email: string;
    name?: string | null;
  };
}

export interface AuthContext extends AuthSession {
  orgId: string;
  role: string;
}

export interface AuthenticatedRequest {
  headers: IncomingHttpHeaders;
  params: { orgId?: string };
  auth?: AuthContext;
}

export const AUTH_SESSION_PROVIDER = Symbol('AUTH_SESSION_PROVIDER');

export interface AuthSessionProvider {
  getSession(headers: IncomingHttpHeaders): Promise<AuthSession | null>;
  handler?: (request: IncomingMessage, response: ServerResponse) => Promise<void>;
}

export const MEMBERSHIP_STORE = Symbol('MEMBERSHIP_STORE');

export interface MembershipStore {
  getRole(userId: string, orgId: string): Promise<string | null>;
}