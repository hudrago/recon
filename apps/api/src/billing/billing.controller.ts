import { Body, Controller, Get, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/zodValidationPipe';
import { OrgGuard } from '../auth/org.guard';
import { listSelfServePlans, type PlanCode } from './plans';
import { BillingService } from './billing.service';

const checkoutSessionSchema = z.object({
  planCode: z.enum(listSelfServePlans().map((plan) => plan.code) as [string, ...string[]]),
});

@Controller('orgs/:orgId/billing')
@UseGuards(OrgGuard)
export class BillingController {
  constructor(@Inject(BillingService) private readonly billing: BillingService) {}

  @Get()
  async status(@Param('orgId') orgId: string) {
    return this.billing.getEntitlement(orgId, new Date());
  }

  @Get('plans')
  plans() {
    return this.billing.getPlanCatalog();
  }

  @Post('checkout-session')
  async checkoutSession(@Param('orgId') orgId: string, @Body(new ZodValidationPipe(checkoutSessionSchema)) body: z.infer<typeof checkoutSessionSchema>) {
    const webUrl = process.env.WEB_URL ?? 'http://localhost:3000';
    return this.billing.createCheckoutSession(
      orgId,
      body.planCode as PlanCode,
      `${webUrl}/billing?checkout=success`,
      `${webUrl}/billing?checkout=cancel`,
    );
  }
}
