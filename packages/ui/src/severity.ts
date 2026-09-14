import { colors } from './tokens';

export type ExceptionSeverity = 'HIGH' | 'MEDIUM' | 'LOW';

// Default severity per exception code — screens may override per merchant context.
export const DEFAULT_SEVERITY_BY_CODE: Record<string, ExceptionSeverity> = {
  REFUND_MISSING: 'HIGH',
  DELIVERY_STALLED: 'HIGH',
  RESTOCK_MISSING: 'MEDIUM',
  INVOICE_MISSING: 'LOW',
};

export const SEVERITY_COLOR: Record<ExceptionSeverity, string> = {
  HIGH: colors.danger,
  MEDIUM: colors.warning,
  LOW: colors.neutral,
};
