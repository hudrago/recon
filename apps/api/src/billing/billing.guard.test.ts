import { ExecutionContext, ForbiddenException, HttpException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { BillingActionGuard } from './billing.guard';
import type { BillingService } from './billing.service';

function contextWithOrgId(orgId: string | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ params: { orgId } }) }),
  } as unknown as ExecutionContext;
}

describe('BillingActionGuard', () => {
  it('allows the request when the organization can still execute actions', async () => {
    const billing = { canExecuteActions: vi.fn().mockResolvedValue(true) } as unknown as BillingService;
    await expect(new BillingActionGuard(billing).canActivate(contextWithOrgId('org_1'))).resolves.toBe(true);
  });

  it('rejects with a structured BILLING_LIMIT_REACHED error once entitlement is exhausted', async () => {
    const billing = { canExecuteActions: vi.fn().mockResolvedValue(false) } as unknown as BillingService;
    const guard = new BillingActionGuard(billing);
    try {
      await guard.canActivate(contextWithOrgId('org_1'));
      expect.unreachable('expected canActivate to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getResponse()).toMatchObject({ code: 'BILLING_LIMIT_REACHED' });
    }
  });

  it('rejects a request with no organization id in the route', async () => {
    const billing = { canExecuteActions: vi.fn() } as unknown as BillingService;
    await expect(new BillingActionGuard(billing).canActivate(contextWithOrgId(undefined))).rejects.toBeInstanceOf(ForbiddenException);
    expect(billing.canExecuteActions).not.toHaveBeenCalled();
  });
});
