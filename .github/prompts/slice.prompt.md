---
description: "Scaffold and implement one Recon vertical slice (a reconciliation rule or an integration adapter), from domain event through tests, gated by pnpm test/typecheck/lint."
agent: "Recon Implementer"
argument-hint: "Exception code or provider capability, plus the triggering condition (e.g. 'INVOICE_MISSING: paid order, no invoice after 2h')"
---

Implement one Recon vertical slice end to end for the request above.

If this is a new exception type or reconciliation rule, follow
[add-reconciliation-rule](../skills/add-reconciliation-rule/SKILL.md).

If this is a new or updated provider adapter, follow
[add-integration-adapter](../skills/add-integration-adapter/SKILL.md).

If it's both (a new exception type that depends on a new adapter capability),
do the adapter first, then the rule.

## Acceptance Criteria

- [ ] Domain glossary updated if this introduces a new exception code or entity field
- [ ] Rule/mapper is a pure function — no I/O, no `Date.now()` inside, `now`/inputs passed in
- [ ] Tests cover: fires, does-not-fire (adjacent case), and a boundary condition
- [ ] Wired into the exception lifecycle (`ingestX` on `ExceptionService` or
      equivalent), deduped on a deterministic exception id
- [ ] No external API calls in tests — fixtures only
- [ ] No action (refund/restock/invoice) executes without human approval,
      unless the merchant explicitly enabled auto-execution for that rule
- [ ] `pnpm test && pnpm typecheck && pnpm lint` all clean

Report back: which exception code/capability was implemented, files changed,
tests added, and anything flagged as a domain-model question or follow-up for
`recon-integration` or `recon-reviewer`.
