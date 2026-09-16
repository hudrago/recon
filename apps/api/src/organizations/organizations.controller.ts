import { Body, Controller, Delete, HttpCode, Inject, Param, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { OrgGuard } from '../auth/org.guard';
import { ZodValidationPipe } from '../common/zodValidationPipe';
import { OrganizationDeletionService } from './organizationDeletion.service';

const deleteOrganizationSchema = z.object({ confirmation: z.string().min(1) }).strict();

@Controller('orgs/:orgId')
@UseGuards(OrgGuard)
export class OrganizationsController {
  constructor(@Inject(OrganizationDeletionService) private readonly organizations: OrganizationDeletionService) {}

  @Delete()
  @HttpCode(204)
  async deleteOrganization(
    @Param('orgId') orgId: string,
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(deleteOrganizationSchema)) body: z.infer<typeof deleteOrganizationSchema>,
  ) {
    await this.organizations.deleteEmptyOrganization(orgId, request.auth!.user.id, body.confirmation);
  }
}