export interface SendEmailRequest {
  to: string;
  subject: string;
  html: string;
}

export interface Mailer {
  send(request: SendEmailRequest): Promise<void>;
}

// NestJS DI token — mirrors REFUND_GATEWAY/RESTOCK_GATEWAY in refundGateway.ts/restockGateway.ts.
export const MAILER = Symbol('MAILER');
