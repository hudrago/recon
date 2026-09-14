import type { Shipment, ShipmentStatus } from '@recon/domain';

const VALID_STATUSES: ReadonlySet<string> = new Set<ShipmentStatus>([
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'RETURNED',
  'CANCELLED',
  'EXCEPTION',
]);

export interface ParsedCarrierCsv {
  shipments: Shipment[];
  errors: string[];
}

// Recon's own CSV contract for the MVP carrier integration (no live carrier API yet, per the
// original architecture decision to start with CSV imports — not a format defined by CTT/DPD).
// Expected header: order_id,tracking_number,status,last_status_change_at
export function parseCarrierStatusCsv(csvText: string, orgId: string): ParsedCarrierCsv {
  const lines = csvText.trim().split(/\r?\n/);
  const [headerLine, ...rows] = lines;
  const headers = headerLine.split(',').map((header) => header.trim());

  const shipments: Shipment[] = [];
  const errors: string[] = [];

  rows.forEach((row, index) => {
    if (!row.trim()) return;

    const cells = row.split(',').map((cell) => cell.trim());
    const record: Record<string, string> = {};
    headers.forEach((header, columnIndex) => {
      record[header] = cells[columnIndex] ?? '';
    });

    const lineNumber = index + 2; // +1 for the header row, +1 to convert to 1-indexed
    const { order_id: orderId, tracking_number: trackingNumber, status, last_status_change_at: lastStatusChangeAt } = record;

    if (!orderId || !trackingNumber || !status || !lastStatusChangeAt) {
      errors.push(`Line ${lineNumber}: missing required column(s)`);
      return;
    }
    if (!VALID_STATUSES.has(status)) {
      errors.push(`Line ${lineNumber}: unknown status "${status}"`);
      return;
    }
    if (Number.isNaN(new Date(lastStatusChangeAt).getTime())) {
      errors.push(`Line ${lineNumber}: invalid date "${lastStatusChangeAt}"`);
      return;
    }

    shipments.push({
      id: trackingNumber,
      orgId,
      orderId,
      status: status as ShipmentStatus,
      lastStatusChangeAt,
    });
  });

  return { shipments, errors };
}
