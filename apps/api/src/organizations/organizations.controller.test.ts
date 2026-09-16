import { Test } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { OrgGuard } from '../auth/org.guard';
import { OrganizationDeletionService } from './organizationDeletion.service';
import { OrganizationsController } from './organizations.controller';

describe('OrganizationsController', () => {
  it('delegates deletion with the trusted authenticated user', async () => {
    const deletion = { deleteEmptyOrganization: vi.fn() };
    const module = await Test.createTestingModule({
      controllers: [OrganizationsController],
      providers: [{ provide: OrganizationDeletionService, useValue: deletion }],
    }).overrideGuard(OrgGuard).useValue({ canActivate: () => true }).compile();
    const controller = module.get(OrganizationsController);
    const request = { auth: { user: { id: 'user_1', email: 'owner@example.com' }, orgId: 'org_1', role: 'owner' } } as AuthenticatedRequest;

    await controller.deleteOrganization('org_1', request, { confirmation: 'recon-test' });

    expect(deletion.deleteEmptyOrganization).toHaveBeenCalledWith('org_1', 'user_1', 'recon-test');
  });
});