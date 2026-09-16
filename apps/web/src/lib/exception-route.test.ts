import { describe, expect, it } from 'vitest';
import { decodeExceptionRouteId, encodeExceptionRouteId } from './exception-route';

describe('exception route IDs', () => {
  it('round-trips identifiers containing URL path separators', () => {
    const exceptionId = 'RESTOCK_MISSING:tenant:gid://shopify/Refund/976312598700';
    const routeId = encodeExceptionRouteId(exceptionId);

    expect(routeId).not.toContain('/');
    expect(routeId).toMatch(/^b64_/);
    expect(decodeExceptionRouteId(routeId)).toBe(exceptionId);
  });

  it('preserves legacy route identifiers', () => {
    expect(decodeExceptionRouteId('REFUND_MISSING:legacy-id')).toBe('REFUND_MISSING:legacy-id');
  });
});