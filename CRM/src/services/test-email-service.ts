import { sendResendEmail } from './resend-email-service';
import nodemailer from 'nodemailer';
import { configuration } from '../config';
import { BusinessError } from '../domain/business-error';

export async function sendTestEmail(to = configuration.email.testTo) {
  if (configuration.email.provider === 'gmail') {
    const { gmailUser, gmailAppPassword } = configuration.email;
    if (!gmailUser || !gmailAppPassword)
      throw new BusinessError(503, 'Configura GMAIL_USER y GMAIL_APP_PASSWORD en .env');
    const transport = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailAppPassword },
      connectionTimeout: 10000,
      socketTimeout: 15000,
    });
    try {
      const result = await transport.sendMail({
        from: { name: 'CRM TSV', address: gmailUser },
        to,
        subject: 'Correo de prueba · CRM TSV',
        text: 'Este es un correo de prueba enviado desde el CRM mediante Gmail.',
      });
      return { id: result.messageId, to, provider: 'gmail' };
    } catch {
      throw new BusinessError(502, 'No se pudo enviar mediante Gmail; revisa la cuenta y su contraseña de aplicación');
    } finally { transport.close(); }
  }
  if (configuration.email.provider !== 'resend') throw new BusinessError(503, 'EMAIL_PROVIDER debe ser gmail o resend');
  const id = await sendResendEmail(to, 'Correo de prueba · CRM TSV', 'Este es un correo de prueba enviado desde el CRM mediante Resend.');
  return { id, to, provider: 'resend' };
}
