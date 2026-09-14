import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type { MembershipStore } from './auth.types';

@Injectable()
export class PrismaMembershipStore implements MembershipStore {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getRole(userId: string, orgId: string): Promise<string | null> {
    const membership = await this.prisma.member.findFirst({
      where: { userId, organizationId: orgId },
      select: { role: true },
    });
    return membership?.role ?? null;
  }
}