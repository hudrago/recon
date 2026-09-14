import { describe, expect, it } from 'vitest';
import { {{CONSTANT_NAME}}_THRESHOLD_MS, evaluate{{RuleName}} } from './{{ruleFileName}}';

describe('evaluate{{RuleName}}', () => {
  it('fires when the threshold has passed and the counter-evidence is missing', () => {
    // build input past the threshold; assert an exception with the right code is returned
  });

  it('does not fire when the counter-evidence exists', () => {
    // e.g. refund/invoice/restock already recorded — assert null
  });

  it('does not fire just under the threshold', () => {
    // elapsed = threshold - 1ms — assert null
  });

  it('fires exactly at the threshold boundary', () => {
    // elapsed === threshold — assert an exception is returned
  });
});
