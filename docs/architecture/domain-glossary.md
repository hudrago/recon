# Domain Glossary

Canonical entities and exception codes. `packages/domain` is the single source
of truth for these shapes — integrations normalize into them, they never leak
provider-specific fields.

## Entities

| Entity | Meaning |
|---|---|
| `Order` | A commerce order from Shopify/WooCommerce, normalized. |
| `Shipment` | A carrier shipment tied to an order, with status history. |
| `Return` | A customer-initiated return of one or more order lines. |
| `Refund` | A monetary refund tied to an order or return. |
| `InventoryAdjustment` | A stock change tied to a return or correction. |
| `Invoice` | A Portuguese fiscal document (InvoiceXpress/Moloni), tied to an order. |
| `Customer` | The buyer, minimal PII footprint (name, email, order history only). |
| `Exception` | A detected mismatch requiring human review or action. |
| `Action` | An approved, idempotent operation executed against a provider. |

## Exception Codes

| Code | Trigger |
|---|---|
| `REFUND_MISSING` | Return delivered/received, no matching refund after 24h. |
| `RESTOCK_MISSING` | Refund completed, no matching inventory adjustment after 4h (default assumption — confirm with operations). |
| `INVOICE_MISSING` | Order paid, no matching invoice after 2h. |
| `DELIVERY_STALLED` | Shipment status unchanged for 72h. |

Adding a new exception code requires: a domain event, a reconciliation rule, an
exception fixture, and a test asserting the rule fires and does not fire on
adjacent cases. See `.github/instructions/domain-model.instructions.md`.

## Non-negotiables

- Financial and inventory `Action`s are idempotent (safe to retry/replay).
- No `Action` executes automatically without approval unless a merchant has
  explicitly enabled auto-execution for that specific rule.
- Every executed `Action` is written to an audit log with who/what/why.
