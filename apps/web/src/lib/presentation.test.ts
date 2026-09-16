import { describe, expect, it } from 'vitest';
import { exceptionDescription, exceptionLabel, readableContextKey, severityLabel, statusLabel } from './presentation';

describe('localized exception presentation', () => {
  it('provides Portuguese operator-facing labels for canonical values', () => {
    expect(exceptionLabel('pt', 'REFUND_MISSING')).toBe('Reembolso em falta');
    expect(statusLabel('pt', 'approved')).toBe('Aprovada');
    expect(severityLabel('pt', 'HIGH')).toBe('Alta');
  });

  it('provides English labels and descriptions', () => {
    expect(exceptionLabel('en', 'REFUND_MISSING')).toBe('Missing refund');
    expect(exceptionDescription('en', 'DELIVERY_STALLED')).toContain('shipment');
    expect(statusLabel('en', 'approved')).toBe('Approved');
    expect(severityLabel('en', 'HIGH')).toBe('High');
  });

  it('falls back to canonical values and formats API context keys', () => {
    expect(exceptionLabel('en', 'NEW_CODE')).toBe('NEW_CODE');
    expect(readableContextKey('lastCarrierUpdate', 'en')).toBe('last carrier update');
    expect(readableContextKey('REFUND_REFERENCE')).toBe('refund reference');
  });
});