import type {
  AiGateway,
  CaseBriefRequest,
  CaseBriefResult,
  ReasonDraftRequest,
  ReasonDraftResult,
} from '../aiGateway';

const PT_SUMMARY_BY_CODE: Record<string, string> = {
  REFUND_MISSING: 'A devolução foi recebida mas o reembolso ainda não foi emitido.',
  RESTOCK_MISSING: 'O reembolso foi emitido mas o stock ainda não foi reposto.',
  INVOICE_MISSING: 'A encomenda foi paga mas a fatura ainda não foi emitida.',
  DELIVERY_STALLED: 'O envio está sem atualização de estado há mais tempo do que o esperado.',
};

// Used by tests and local dev without OpenAI credentials — never calls a real API. Output is
// deterministic (keyed only on exception code + locale) so it never flakes an assertion.
export class FakeAiGateway implements AiGateway {
  async summarizeCase(request: CaseBriefRequest): Promise<CaseBriefResult> {
    const summary = PT_SUMMARY_BY_CODE[request.code] ?? `Exceção ${request.code} para a encomenda ${request.orderId}.`;
    return {
      summary: `${summary} (encomenda ${request.orderId})`,
      recommendation: `Rever e decidir se aprova a resolução de ${request.code}.`,
      rationale: `Detetado em ${request.detectedAt}, estado atual ${request.status}.`,
      requiresApproval: true,
      modelId: 'fake-ai-gateway',
    };
  }

  async draftReason(request: ReasonDraftRequest): Promise<ReasonDraftResult> {
    const draft =
      request.intent === 'approve'
        ? `Aprovado após revisão do caso ${request.code} para a encomenda ${request.orderId}.`
        : `Arquivado após revisão do caso ${request.code} para a encomenda ${request.orderId}.`;
    return { draft, requiresApproval: true, modelId: 'fake-ai-gateway' };
  }
}
