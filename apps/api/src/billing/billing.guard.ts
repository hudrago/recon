import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { BillingService } from './billing.service';

// Applied only to endpoints that execute a provider-side action (refund, restock, invoice).
// Must run after OrgGuard, which populates request.params.orgId and confirms membership.
@Injectable()
export class BillingActionGuard implements CanActivate {
  constructor(@Inject(BillingService) private readonly billing: BillingService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const orgId = request.params.orgId;
    if (!orgId) throw new ForbiddenException();

    const allowed = await this.billing.canExecuteActions(orgId, new Date());
    if (!allowed) {
      throw new ForbiddenException({ code: 'BILLING_LIMIT_REACHED', message: 'Upgrade the plan or wait for the next billing period to execute new actions.' });
    }
    return true;
  }
}
