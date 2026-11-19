import { sendEmail } from './email-service';
import { configuration } from '../config';

export async function sendTestEmail(to = configuration.email.testTo) {
  const id = await sendEmail(to, 'Correo de prueba · CRM TSV', 'Este es un correo de prueba enviado desde el CRM mediante Gmail.');
  return { id, to, provider: 'gmail' };
}
