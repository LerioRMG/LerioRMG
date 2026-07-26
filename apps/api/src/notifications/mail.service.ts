import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface MailPayload {
  to: string;
  subject: string;
  text: string;
}

/**
 * Servizio email transazionali. Se SMTP_HOST non è configurato, usa un transport
 * "log" che scrive il contenuto nei log invece di inviare realmente l'email:
 * evita di dichiarare una funzione come operativa quando il provider non è configurato.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly configured: boolean;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    this.configured = Boolean(host);
    if (this.configured) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(this.config.get<string>('SMTP_PORT') || 587),
        auth: {
          user: this.config.get<string>('SMTP_USER'),
          pass: this.config.get<string>('SMTP_PASSWORD'),
        },
      });
    }
  }

  async send(payload: MailPayload) {
    if (!this.configured || !this.transporter) {
      this.logger.warn(
        `SMTP non configurato ("Provider non configurato"): email non inviata realmente. Destinatario: ${payload.to} - Oggetto: ${payload.subject}`,
      );
      this.logger.debug(payload.text);
      return { delivered: false, reason: 'SMTP non configurato' };
    }
    await this.transporter.sendMail({
      from: this.config.get<string>('SMTP_FROM') || 'no-reply@honeygarden.local',
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
    });
    return { delivered: true };
  }
}
