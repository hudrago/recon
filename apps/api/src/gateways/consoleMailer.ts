import { Injectable, Logger } from '@nestjs/common';
import type { Mailer, SendEmailRequest } from '../mailer';

// Used in dev/test and whenever no email provider is configured — logs instead of sending, so
// invitation/verification flows are still exercisable without a real mailbox.
@Injectable()
export class ConsoleMailer implements Mailer {
  private readonly logger = new Logger(ConsoleMailer.name);

  async send(request: SendEmailRequest): Promise<void> {
    this.logger.log(`[console-mailer] to=${request.to} subject="${request.subject}"`);
  }
}
