import type { DomainException } from '../exceptions';
// import the entities this rule needs, e.g. { Order, Invoice } from '../entities';

export const {{CONSTANT_NAME}}_THRESHOLD_MS = 0; // e.g. 24 * 60 * 60 * 1000

export interface {{RuleName}}Input {
  // the normalized data this rule needs, e.g. order: Order; invoices: Invoice[];
  now: Date;
}

// Deterministic per subject, so re-running the rule never creates a duplicate exception.
export function {{ruleName}}ExceptionId(/* subject: e.g. Order */): string {
  return `{{EXCEPTION_CODE}}:${/* subject.id */ ''}`;
}

export function evaluate{{RuleName}}({ now }: {{RuleName}}Input): DomainException | null {
  // 1. return null if the counter-evidence already exists (invoice/refund/restock/etc.)
  // 2. return null if elapsed time is under the threshold
  // 3. otherwise return the Exception
  return {
    id: {{ruleName}}ExceptionId(),
    orgId: '',
    code: '{{EXCEPTION_CODE}}',
    orderId: '',
    detectedAt: now.toISOString(),
    status: 'open',
    context: {},
  };
}
