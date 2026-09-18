import type { DomainException } from '@recon/domain';
import type { CaseBriefRequest, CaseBriefTimelineEntry, SupportedLocale } from '../aiGateway';
import type { AuditLogItem } from '../exceptionService';

// Every field an exception's `context` (Record<string, unknown>, freeform) is allowed to carry
// into a CaseBriefRequest. Anything else — including any PII a future provider payload might
// smuggle into context — is silently dropped. This is the ONLY place that decides what reaches
// the AI gateway; never pass `exception.context` or a raw AuditLogEntry to a gateway directly.
const ALLOWED_CONTEXT_KEYS = ['elapsedMs', 'returnId', 'refundId', 'shipmentId'] as const;

// Pure function — no I/O, fully unit-testable, matches the "rule function" shape used elsewhere
// in this codebase even though it isn't a reconciliation rule itself.
export function buildBriefInput(
  exception: DomainException,
  audit: AuditLogItem[],
  locale: SupportedLocale,
): CaseBriefRequest {
  const contextFacts: Record<string, unknown> = {};
  for (const key of ALLOWED_CONTEXT_KEYS) {
    if (key in exception.context) contextFacts[key] = exception.context[key];
  }

  const timeline: CaseBriefTimelineEntry[] = audit.map((item) => ({
    actorRole: actorRole(item.actor),
    at: item.at,
    statusBefore: item.statusBefore,
    statusAfter: item.statusAfter,
    actionKind: item.actionKind,
  }));

  return {
    locale,
    code: exception.code,
    status: exception.status,
    orderId: exception.orderId,
    detectedAt: exception.detectedAt,
    contextFacts,
    timeline,
  };
}

// Audit `actor` is a user id/email or a "system:*" tag — never forward the raw value, only a
// coarse role. Free-text `reason` is deliberately never included in the timeline sent upstream.
function actorRole(actor: string): string {
  return actor.startsWith('system:') ? actor : 'operator';
}
