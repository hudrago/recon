import { Injectable } from '@nestjs/common';
import type {
  AiGateway,
  CaseBriefRequest,
  CaseBriefResult,
  ReasonDraftRequest,
  ReasonDraftResult,
  SupportedLocale,
} from '../aiGateway';

interface ChatCompletionResponse {
  choices: Array<{ message: { content: string } }>;
}

interface CaseBriefCompletion {
  summary: string;
  recommendation: string;
  rationale: string;
}

interface ReasonDraftCompletion {
  draft: string;
}

// Real OpenAI integration (plain fetch, no SDK, mirrors InvoiceXpressGateway/ShopifyRefundGateway).
// `baseUrl` must be the EU regional endpoint (https://eu.api.openai.com/v1) in production — that
// is enforced by config.ts's env validation, not here. `store: false` on every request: Recon
// never opts into OpenAI's application-state retention regardless of environment.
@Injectable()
export class OpenAiGateway implements AiGateway {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly baseUrl: string,
  ) {}

  async summarizeCase(request: CaseBriefRequest): Promise<CaseBriefResult> {
    const content = await this.complete(
      briefSystemPrompt(request.locale),
      JSON.stringify({
        code: request.code,
        status: request.status,
        orderId: request.orderId,
        detectedAt: request.detectedAt,
        contextFacts: request.contextFacts,
        timeline: request.timeline,
      }),
    );
    const parsed = JSON.parse(content) as CaseBriefCompletion;
    return {
      summary: parsed.summary,
      recommendation: parsed.recommendation,
      rationale: parsed.rationale,
      requiresApproval: true,
      modelId: this.model,
    };
  }

  async draftReason(request: ReasonDraftRequest): Promise<ReasonDraftResult> {
    const content = await this.complete(
      reasonSystemPrompt(request.locale, request.intent),
      JSON.stringify({ code: request.code, orderId: request.orderId, contextFacts: request.contextFacts }),
    );
    const parsed = JSON.parse(content) as ReasonDraftCompletion;
    return { draft: parsed.draft, requiresApproval: true, modelId: this.model };
  }

  private async complete(systemPrompt: string, userPayload: string): Promise<string> {
    try {
      return await this.attemptCompletion(systemPrompt, userPayload);
    } catch {
      // Single retry — transient network/5xx failures shouldn't fail an on-demand page load twice.
      return this.attemptCompletion(systemPrompt, userPayload);
    }
  }

  private async attemptCompletion(systemPrompt: string, userPayload: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          model: this.model,
          store: false,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPayload },
          ],
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`OpenAI request failed: ${response.status} ${response.statusText}`);
      }
      const body = (await response.json()) as ChatCompletionResponse;
      const content = body.choices[0]?.message.content;
      if (!content) throw new Error('OpenAI response had no content');
      return content;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function briefSystemPrompt(locale: SupportedLocale): string {
  return locale === 'pt'
    ? 'És um assistente que resume casos de reconciliação de e-commerce em português de Portugal. ' +
        'Recebes apenas factos já validados (nunca decides valores). Responde em JSON estrito com os ' +
        'campos summary, recommendation e rationale, cada um com 1-2 frases curtas. Nunca instruas a ' +
        'execução de uma ação — apenas resume e recomenda para revisão humana.'
    : 'You summarize e-commerce reconciliation cases. You only receive already-validated facts ' +
        '(you never decide amounts). Respond in strict JSON with fields summary, recommendation, ' +
        'and rationale, each 1-2 short sentences. Never instruct execution of an action — only ' +
        'summarize and recommend for human review.';
}

function reasonSystemPrompt(locale: SupportedLocale, intent: 'approve' | 'dismiss'): string {
  const action = intent === 'approve' ? 'aprovação' : 'arquivamento';
  return locale === 'pt'
    ? `Escreve um rascunho curto (1 frase) do motivo de ${action} de um caso de reconciliação, ` +
        'em português de Portugal, para um operador rever e editar antes de submeter. Responde em ' +
        'JSON estrito com o campo draft.'
    : `Write a short (1 sentence) draft reason for the ${intent} of a reconciliation case, for an ` +
        'operator to review and edit before submitting. Respond in strict JSON with a draft field.';
}
