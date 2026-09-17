import { Body, Controller, Get, HttpCode, Inject, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { DomainException } from '@recon/domain';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/zodValidationPipe';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { OrgGuard } from '../auth/org.guard';
import { BillingActionGuard } from '../billing/billing.guard';
import { ExceptionService } from '../exceptionService';

const dismissSchema = z.object({ reason: z.string().min(1) });
const approveSchema = z
  .object({
    reason: z.string().min(1),
    amountMinor: z.number().int().positive().safe().optional(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .optional(),
    quantity: z.number().int().positive().safe().optional(),
  })
  .refine(
    (body) =>
      (body.amountMinor === undefined) === (body.currency === undefined),
    {
      message: "Refund amount and currency must be provided together",
    },
  );

const refundActionSchema = z.object({}).strict();
const restockActionSchema = z.object({}).strict();
const invoiceActionSchema = z.object({}).strict();

@Controller("orgs/:orgId/exceptions")
@UseGuards(OrgGuard)
export class ExceptionsController {
  // esbuild (used by vitest) doesn't implement emitDecoratorMetadata, so Nest can't infer this
  // parameter's type from design:paramtypes — @Inject makes the token explicit instead.
  constructor(
    @Inject(ExceptionService) private readonly exceptions: ExceptionService,
  ) {}

  @Get()
  list(@Param("orgId") orgId: string) {
    return this.exceptions.listOpenExceptions(orgId);
  }

  @Get(":exceptionId")
  getOne(
    @Param("orgId") orgId: string,
    @Param("exceptionId") exceptionId: string,
  ) {
    return this.getExceptionForOrg(exceptionId, orgId);
  }

  @Get(":exceptionId/audit")
  async getAudit(
    @Param("orgId") orgId: string,
    @Param("exceptionId") exceptionId: string,
  ) {
    await this.getExceptionForOrg(exceptionId, orgId);
    return this.exceptions.getAuditLogForException(orgId, exceptionId);
  }

  @Post(":exceptionId/approve")
  @HttpCode(200)
  async approve(
    @Param("orgId") orgId: string,
    @Param("exceptionId") exceptionId: string,
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(approveSchema))
    body: z.infer<typeof approveSchema>,
  ) {
    await this.getExceptionForOrg(exceptionId, orgId);
    await this.exceptions.approve(
      exceptionId,
      request.auth!.user.id,
      body.reason,
      body.amountMinor !== undefined && body.currency
        ? { amountMinor: body.amountMinor, currency: body.currency }
        : undefined,
      body.quantity !== undefined ? { quantity: body.quantity } : undefined,
    );
    return { status: "approved" };
  }

  @Post(":exceptionId/dismiss")
  @HttpCode(200)
  async dismiss(
    @Param("orgId") orgId: string,
    @Param("exceptionId") exceptionId: string,
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(dismissSchema))
    body: z.infer<typeof dismissSchema>,
  ) {
    await this.getExceptionForOrg(exceptionId, orgId);
    await this.exceptions.dismiss(
      exceptionId,
      request.auth!.user.id,
      body.reason,
    );
    return { status: "dismissed" };
  }

  @Post(":exceptionId/actions/refund")
  @HttpCode(200)
  @UseGuards(BillingActionGuard)
  async executeRefund(
    @Param("orgId") orgId: string,
    @Param("exceptionId") exceptionId: string,
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(refundActionSchema))
    _body: z.infer<typeof refundActionSchema>,
  ) {
    await this.getExceptionForOrg(exceptionId, orgId);
    return this.exceptions.executeRefund(
      { exceptionId },
      request.auth!.user.id,
    );
  }

  @Post(":exceptionId/actions/restock")
  @HttpCode(200)
  @UseGuards(BillingActionGuard)
  async executeRestock(
    @Param("orgId") orgId: string,
    @Param("exceptionId") exceptionId: string,
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(restockActionSchema))
    _body: z.infer<typeof restockActionSchema>,
  ) {
    await this.getExceptionForOrg(exceptionId, orgId);
    return this.exceptions.executeRestock(
      { exceptionId },
      request.auth!.user.id,
    );
  }

  @Post(":exceptionId/actions/invoice")
  @HttpCode(200)
  @UseGuards(BillingActionGuard)
  async executeIssueInvoice(
    @Param("orgId") orgId: string,
    @Param("exceptionId") exceptionId: string,
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(invoiceActionSchema))
    _body: z.infer<typeof invoiceActionSchema>,
  ) {
    await this.getExceptionForOrg(exceptionId, orgId);
    return this.exceptions.executeIssueInvoice(
      { exceptionId },
      request.auth!.user.id,
    );
  }

  // Every endpoint confirms the exception actually belongs to the org in the URL, not just that it exists.
  private async getExceptionForOrg(
    exceptionId: string,
    orgId: string,
  ): Promise<DomainException> {
    const exception = await this.exceptions.getException(exceptionId);
    if (!exception || exception.orgId !== orgId) {
      throw new NotFoundException();
    }
    return exception;
  }
}
