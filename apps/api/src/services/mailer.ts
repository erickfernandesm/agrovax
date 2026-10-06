import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../lib/logger';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/** Abstracao de envio de e-mail, para trocar de provedor sem tocar nas regras. */
export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

/** Desenvolvimento: nao envia nada, apenas escreve a mensagem no log. */
class ConsoleMailer implements Mailer {
  async send(message: MailMessage): Promise<void> {
    logger.info({ to: message.to, subject: message.subject }, `E-mail (nao enviado):\n${message.text}`);
  }
}

class SmtpMailer implements Mailer {
  private readonly transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
  });

  async send(message: MailMessage): Promise<void> {
    await this.transport.sendMail({ from: env.MAIL_FROM, ...message });
  }
}

/**
 * Producao sem SMTP configurado: a mensagem NAO e enviada nem escrita no log
 * (o log de producao nao deve conter codigos de recuperacao de senha).
 */
class DisabledMailer implements Mailer {
  async send(message: MailMessage): Promise<void> {
    logger.warn(
      { subject: message.subject },
      'E-mail nao enviado: SMTP nao configurado (defina SMTP_HOST).',
    );
  }
}

export function createMailer(): Mailer {
  if (env.SMTP_HOST) return new SmtpMailer();
  if (env.NODE_ENV === 'production') {
    logger.warn('SMTP nao configurado: a recuperacao de senha por e-mail esta indisponivel.');
    return new DisabledMailer();
  }
  return new ConsoleMailer();
}
