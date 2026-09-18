import { describe, expect, it } from 'vitest';
import type { DomainException } from '@recon/domain';
import type { AuditLogItem } from '../exceptionService';
import { buildBriefInput } from './buildBriefInput';

function makeException(context: Record<string, unknown>): DomainException {
  return {
    id: 'RESTOCK_MISSING:org_1:rf_1',
    orgId: 'org_1',
    code: 'RESTOCK_MISSING',
    orderId: 'order_1',
    detectedAt: '2026-09-01T10:00:00.000Z',
    status: 'open',
    context,
  };
}

describe('buildBriefInput', () => {
  it('carries only allowlisted context keys, dropping anything unexpected', () => {
    const exception = makeException({
      refundId: 'rf_1',
      elapsedMs: 3_600_000,
      customerEmail: 'maria@example.com',
      shippingAddress: 'Rua Exemplo 123, Lisboa',
    });

    const result = buildBriefInput(exception, [], 'pt');

    expect(result.contextFacts).toEqual({ refundId: 'rf_1', elapsedMs: 3_600_000 });
    expect(JSON.stringify(result)).not.toContain('maria@example.com');
    expect(JSON.stringify(result)).not.toContain('Rua Exemplo');
  });

  it('reduces the audit trail to a role, never the raw actor or free-text reason', () => {
    const exception = makeException({});
    const audit: AuditLogItem[] = [
      {
        actor: 'operator@merchant.example',
        reason: 'Customer Maria Silva called about her missing refund',
        at: '2026-09-01T11:00:00.000Z',
        statusBefore: 'open',
        statusAfter: 'approved',
      },
    ];

    const result = buildBriefInput(exception, audit, 'pt');

    expect(result.timeline).toEqual([
      { actorRole: 'operator', at: '2026-09-01T11:00:00.000Z', statusBefore: 'open', statusAfter: 'approved', actionKind: undefined },
    ]);
    expect(JSON.stringify(result)).not.toContain('operator@merchant.example');
    expect(JSON.stringify(result)).not.toContain('Maria Silva');
  });

  it('preserves a system actor tag as-is (not PII)', () => {
    const exception = makeException({});
    const audit: AuditLogItem[] = [
      { actor: 'system:shopify-webhook', reason: 'Observed Shopify refund rf_1', at: '2026-09-01T11:00:00.000Z' },
    ];

    const result = buildBriefInput(exception, audit, 'pt');

    expect(result.timeline[0].actorRole).toBe('system:shopify-webhook');
  });
});
