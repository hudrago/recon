import type { ExceptionCode, ExceptionStatus } from '@recon/domain';

export type SupportedLocale = 'pt' | 'en';

export interface CaseBriefTimelineEntry {
  actorRole: string;
  at: string;
  statusBefore?: string;
  statusAfter?: string;
  actionKind?: string;
}

// The ONLY shape allowed to reach an AI gateway — see ai/buildBriefInput.ts, the redaction
// boundary that assembles this from a DomainException + audit log. No raw context/reason text.
export interface CaseBriefRequest {
  locale: SupportedLocale;
  code: ExceptionCode;
  status: ExceptionStatus;
  orderId: string;
  detectedAt: string;
  contextFacts: Record<string, unknown>;
  timeline: CaseBriefTimelineEntry[];
}

// `requiresApproval` is a literal `true` — the type system itself forbids wiring this result
// into anything that executes an action (see copilot-instructions.md's LLM carve-out).
export interface CaseBriefResult {
  summary: string;
  recommendation: string;
  rationale: string;
  requiresApproval: true;
  modelId: string;
}

export interface ReasonDraftRequest {
  locale: SupportedLocale;
  intent: 'approve' | 'dismiss';
  code: ExceptionCode;
  orderId: string;
  contextFacts: Record<string, unknown>;
}

export interface ReasonDraftResult {
  draft: string;
  requiresApproval: true;
  modelId: string;
}

export interface AiGateway {
  summarizeCase(request: CaseBriefRequest): Promise<CaseBriefResult>;
  draftReason(request: ReasonDraftRequest): Promise<ReasonDraftResult>;
}

// NestJS DI token — mirrors REFUND_GATEWAY/RESTOCK_GATEWAY/INVOICE_GATEWAY.
export const AI_GATEWAY = Symbol('AI_GATEWAY');
