---
applyTo: "apps/web/**"
description: "Rules for the operations inbox, case timeline, and approvals UI."
---

# Web — Operations Inbox

`apps/web` is the merchant-facing operator surface: exception inbox, case
timeline, approvals, reports, integration settings.

## Rules

- All data access goes through `apps/api` — never call a provider SDK or
  `packages/integrations` directly from the frontend.
- Any action that moves money, stock, or issues an invoice requires an
  explicit confirm step in the UI, even if the backend also enforces approval.
- UI text is Portuguese-first (pt-PT); don't hardcode English strings in
  merchant-facing surfaces — use the i18n layer already in the app.
- Follow existing component/library conventions already present in
  `apps/web` before introducing a new one.
