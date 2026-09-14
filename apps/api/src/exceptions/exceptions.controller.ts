import { Body, Controller, Get, HttpCode, Inject, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { DomainException } from '@recon/domain';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/zodValidationPipe';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { OrgGuard } from '../auth/org.guard';
import { ExceptionService } from '../exceptionService';

const dismissSchema = z.object({ reason: z.string().min(1) });

const refundActionSchema = z.object({
  idempotencyKey: z.string().min(1),
  orderId: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().length(3),
});

@Controller('orgs/:orgId/exceptions')
@UseGuards(OrgGuard)
export class ExceptionsController {
  // esbuild (used by vitest) doesn't implement emitDecoratorMetadata, so Nest can't infer this
  // parameter's type from design:paramtypes — @Inject makes the token explicit instead.
  constructor(@Inject(ExceptionService) private readonly exceptions: ExceptionService) {}

  @Get()
  list(@Param('orgId') orgId: string) {
    return this.exceptions.listOpenExceptions(orgId);
  }

  @Get(':exceptionId')
  getOne(@Param('orgId') orgId: string, @Param('exceptionId') exceptionId: string) {
    return this.getExceptionForOrg(exceptionId, orgId);
  }

  @Post(':exceptionId/approve')
  @HttpCode(200)
  async approve(@Param('orgId') orgId: string, @Param('exceptionId') exceptionId: string) {
    await this.getExceptionForOrg(exceptionId, orgId);
    await this.exceptions.approve(exceptionId);
    return { status: 'approved' };
  }

  @Post(':exceptionId/dismiss')
  @HttpCode(200)
  async dismiss(
    @Param('orgId') orgId: string,
    @Param('exceptionId') exceptionId: string,
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(dismissSchema)) body: z.infer<typeof dismissSchema>,
  ) {
    await this.getExceptionForOrg(exceptionId, orgId);
    await this.exceptions.dismiss(exceptionId, request.auth!.user.id, body.reason);
    return { status: 'dismissed' };
  }

  @Post(':exceptionId/actions/refund')
  @HttpCode(200)
  async executeRefund(
    @Param('orgId') orgId: string,
    @Param('exceptionId') exceptionId: string,
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(refundActionSchema)) body: z.infer<typeof refundActionSchema>,
  ) {
    await this.getExceptionForOrg(exceptionId, orgId);
    return this.exceptions.executeRefund(
      {
        idempotencyKey: body.idempotencyKey,
        exceptionId,
        orderId: body.orderId,
        amount: body.amount,
        currency: body.currency,
      },
      request.auth!.user.id,
    );
  }

  // Every endpoint confirms the exception actually belongs to the org in the URL, not just that it exists.
  private async getExceptionForOrg(exceptionId: string, orgId: string): Promise<DomainException> {
    const exception = await this.exceptions.getException(exceptionId);
    if (!exception || exception.orgId !== orgId) {
      throw new NotFoundException();
    }
    return exception;
  }
}
