import { describe, expect, it } from 'vitest';
import { shopifyReturnCloseFixture } from './__fixtures__/returnReceived.fixture';
import { mapShopifyReturnToDomain } from './mapReturn';

describe('mapShopifyReturnToDomain', () => {
  it('maps the fixture payload to a domain ReturnRecord using the header-derived timestamp', () => {
    const triggeredAt = '2026-09-01T10:00:00.000Z';
    const result = mapShopifyReturnToDomain(shopifyReturnCloseFixture, triggeredAt, 'org_1');
    expect(result).toEqual({
      id: '123134564567890',
      orgId: 'org_1',
      orderId: '4783296544821',
      receivedAt: triggeredAt,
    });
  });
});
