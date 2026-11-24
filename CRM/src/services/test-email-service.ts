import { BusinessError } from '../domain/business-error';
import { emailFormat } from '../auth';
import { sendEmail } from './email-service';
import { configuration } from '../config';

export async function sendTestEmail(recipient: unknown = configuration.email.testTo) {
  const to = typeof recipient === 'string' ? recipient.trim() : '';
  if (!to || to.length > 254 || !emailFormat.test(to) || /[,;:"()]/.test(to))
    throw new BusinessError(400, 'Indica un único correo de destino válido.');
  const id = await sendEmail(to, 'Correo de prueba · CRM TSV', 'Este es un correo de prueba enviado desde el CRM mediante Gmail.');
  return { id, to, provider: 'gmail' };
}
