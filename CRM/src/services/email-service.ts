import nodemailer from 'nodemailer';
import { configuration } from '../config';
import { BusinessError } from '../domain/business-error';

export async function sendEmail(to: string, subject: string, text: string): Promise<string> {
  const { gmailUser, gmailAppPassword } = configuration.email;
  if (!gmailUser || !gmailAppPassword) throw new BusinessError(503, 'Configura GMAIL_USER y GMAIL_APP_PASSWORD en .env');
  const transport = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: gmailUser, pass: gmailAppPassword },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
  try {
    const result = await transport.sendMail({ from: { name: 'CRM TSV', address: gmailUser }, to, subject, text });
    if (!result.accepted?.length) throw new Error('Recipient not accepted');
    return result.messageId;
  } catch {
    throw new BusinessError(502, 'No se pudo enviar mediante Gmail; revisa la cuenta y su contraseña de aplicación');
  } finally { transport.close(); }
}
