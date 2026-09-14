import { describe, expect, it } from 'vitest';
import { formatMoney } from './money';

describe('formatMoney', () => {
  it('formats EUR amounts for the Portuguese locale', () => {
    const result = formatMoney(1234.5, 'EUR');
    expect(result).toContain('€');
    expect(result.replace(/[\s\u00A0\u202F]/g, '')).toContain('1234,50');
  });

  it('formats other currencies with their own symbol/format', () => {
    expect(formatMoney(10, 'USD', 'en-US')).toBe('$10.00');
  });
});
