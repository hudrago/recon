# 0002. AI-assisted case briefs (summarize/draft only, never decide)

Status: accepted

## Context

Operators open a case and see `exception.context` rendered as a raw
key/value `<dl>` (via `readableContextKey`), and must type a `reason` from
scratch to approve or dismiss. `copilot-instructions.md` explicitly carves
out one AI use case: *"summarize/draft/classify with a `requiresApproval:
true` recommendation"* — never decide whether to issue a refund.
`domain-model.instructions.md` separately bans AI from reconciliation rules
entirely ("no side effects, no randomness, no calls to AI models").

## Decision

- New `AiGateway` interface (`apps/api/src/aiGateway.ts`) with two methods,
  `summarizeCase` and `draftReason`, both returning a result whose
  `requiresApproval` field is typed as the **literal `true`** — the type
  system itself forbids wiring an AI result into anything that executes an
  action. Wired exactly like every other gateway (`FakeAiGateway` in tests
  and until enabled, real `OpenAiGateway` behind `useAi` in `app.module.ts`).
- A pure redaction boundary, `ai/buildBriefInput.ts`, is the ONLY place
  allowed to shape data for the AI gateway. It allowlists four `context` keys
  (`elapsedMs`, `returnId`, `refundId`, `shipmentId`) and reduces the audit
  trail to a role + timestamps + status transitions — never the raw
  `context` blob, never `AuditLogEntry.reason` free text, never an actor
  email.
- Approval/restock amounts and quantities are never computed by the AI
  gateway. `ai/suggestApprovalTerms.ts` is the single designated seam for any
  future deterministic prefill; today it returns `{}` for every code because
  Recon's domain model doesn't persist the per-order line totals or unit
  quantities such a suggestion would need — fabricating a heuristic without
  that data would mislead an operator, so it's left honest rather than
  guessing.
- Briefs are cached (`CaseBrief` Prisma model, `@@id([orgId, exceptionId,
  locale])`) keyed by `inputHash` (sha256 of the redacted input + a
  `promptVersion` constant), generated on-demand when a case is opened.
  Reopening a case with no new audit activity never re-calls the model.
- `reasonSource: 'human' | 'ai-draft' | 'ai-edited'` is threaded from the web
  form through `approve()`/`dismiss()` into the audit entry, so an auditor
  can see at a glance which reasons were AI-drafted vs. typed by hand.
- EU data residency: `OPENAI_BASE_URL` defaults to `https://eu.api.openai.com/v1`
  and `config.ts` rejects any other base URL in production. OpenAI's EU
  region requires Zero Data Retention or Modified Abuse Monitoring approval
  (a sales-gated process) — building against `FakeAiGateway` means this
  compliance lead time never blocks the code from shipping; the real gateway
  is a single env-var flip once approved, same precedent as
  `CarrierTrackingGateway` staying fake until a real CTT/DPD integration
  exists.

## Consequences

- `GET :exceptionId/brief` and `POST :exceptionId/reason-draft` sit under the
  same `OrgGuard` as every other exception route, but deliberately have **no**
  `BillingActionGuard` — they consume no action entitlement and never mutate
  `exception.status`, verified by an explicit money-safety test asserting
  status is unchanged and no `ExecutedAction` row is created.
- LLM output is not assertion-stable, so no eval suite runs inside `pnpm
  test`; only `FakeAiGateway`'s deterministic canned text is asserted there.
  A future `tests/evals/` suite (a separate `pnpm test:evals` script) is the
  right place for loose, fixture-based prompt-quality checks.
- The web UI never treats a missing/failing brief as an error: `getCaseBrief`
  in `apps/web/src/lib/api.ts` catches any failure and returns `null`, and
  `CaseBrief.tsx` renders nothing in that case — the AI panel is additive,
  never load-bearing.

## Alternatives Considered

- **Precompute briefs via a background job at exception creation** — rejected
  for v1: the existing BullMQ jobs (`ReevaluationJob`, `CarrierTrackingJob`)
  are hourly-scheduled, not event-driven: adding event-driven job plumbing
  just for this would be new infrastructure for marginal latency benefit over
  on-demand + cache.
- **Let the AI suggest approval amounts/quantities directly** — rejected:
  would violate the explicit "AI never decides money" rule and there is no
  reliable source data for it yet in the domain model regardless.
- **Store the raw `context`/audit blob and redact client-side** — rejected:
  redaction must happen before the data leaves the process that has it,
  never trust a downstream boundary (browser, or even the AI gateway itself)
  to drop sensitive fields.
