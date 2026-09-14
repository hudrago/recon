import { Injectable } from '@nestjs/common';
import type { IncomingHttpHeaders } from 'node:http';
import type { AuthSession, AuthSessionProvider, MembershipStore } from './auth.types';

@Injectable()
export class DisabledAuthSessionProvider implements AuthSessionProvider {
  async getSession(_headers: IncomingHttpHeaders): Promise<AuthSession | null> {
    return null;
  }
}

@Injectable()
export class DisabledMembershipStore implements MembershipStore {
  async getRole(_userId: string, _orgId: string): Promise<string | null> {
    return null;
  }
}