import { ConflictException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma.service';
import { OrganizationDeletionService } from './organizationDeletion.service';

function createTransaction(overrides: Record<string, unknown> = {}) {
  return {
    organization: { findUnique: vi.fn().mockResolvedValue({ id: 'org_1', slug: 'recon-test', members: [{ userId: 'user_1', role: 'owner' }] }), delete: vi.fn() },
    exceptionRecord: { count: vi.fn().mockResolvedValue(0) },
    pendingEvaluation: { count: vi.fn().mockResolvedValue(0) },
    refundRecord: { count: vi.fn().mockResolvedValue(0) },
    webhookReceipt: { count: vi.fn().mockResolvedValue(0) },
    executedAction: { count: vi.fn().mockResolvedValue(0) },
    auditLogEntry: { count: vi.fn().mockResolvedValue(0) },
    session: { updateMany: vi.fn() },
    ...overrides,
  };
}

describe('OrganizationDeletionService', () => {
  it('deletes an empty organization owned by its sole member', async () => {
    const transaction = createTransaction({ organization: { findUnique: vi.fn().mockResolvedValue({ id: 'org_1', slug: 'recon-test', members: [{ userId: 'user_1', role: 'admin,owner' }] }), delete: vi.fn() } });
    const prisma = { $transaction: vi.fn((callback) => callback(transaction)) } as unknown as PrismaService;
    await new OrganizationDeletionService(prisma).deleteEmptyOrganization('org_1', 'user_1', 'recon-test');
    expect(transaction.organization.delete).toHaveBeenCalledWith({ where: { id: 'org_1' } });
    expect(transaction.session.updateMany).toHaveBeenCalledWith({ where: { activeOrganizationId: 'org_1' }, data: { activeOrganizationId: null } });
  });

  it('rejects non-owners and organizations with other members', async () => {
    const nonOwner = createTransaction({ organization: { findUnique: vi.fn().mockResolvedValue({ id: 'org_1', slug: 'recon-test', members: [{ userId: 'user_1', role: 'member' }] }), delete: vi.fn() } });
    await expect(new OrganizationDeletionService({ $transaction: (callback: never) => (callback as (value: unknown) => unknown)(nonOwner) } as PrismaService).deleteEmptyOrganization('org_1', 'user_1', 'recon-test')).rejects.toBeInstanceOf(ForbiddenException);

    const multiple = createTransaction({ organization: { findUnique: vi.fn().mockResolvedValue({ id: 'org_1', slug: 'recon-test', members: [{ userId: 'user_1', role: 'owner' }, { userId: 'user_2', role: 'member' }] }), delete: vi.fn() } });
    await expect(new OrganizationDeletionService({ $transaction: (callback: never) => (callback as (value: unknown) => unknown)(multiple) } as PrismaService).deleteEmptyOrganization('org_1', 'user_1', 'recon-test')).rejects.toThrow('ORGANIZATION_HAS_OTHER_MEMBERS');
  });

  it('retains organizations with operational history', async () => {
    const transaction = createTransaction({ exceptionRecord: { count: vi.fn().mockResolvedValue(1) } });
    const prisma = { $transaction: vi.fn((callback) => callback(transaction)) } as unknown as PrismaService;
    await expect(new OrganizationDeletionService(prisma).deleteEmptyOrganization('org_1', 'user_1', 'recon-test')).rejects.toBeInstanceOf(ConflictException);
    expect(transaction.organization.delete).not.toHaveBeenCalled();
  });

  it('retains webhook receipts as replay tombstones', async () => {
    const transaction = createTransaction({ webhookReceipt: { count: vi.fn().mockResolvedValue(1) } });
    const prisma = { $transaction: vi.fn((callback) => callback(transaction)) } as unknown as PrismaService;
    await expect(new OrganizationDeletionService(prisma).deleteEmptyOrganization('org_1', 'user_1', 'recon-test')).rejects.toBeInstanceOf(ConflictException);
    expect(transaction.organization.delete).not.toHaveBeenCalled();
  });
});