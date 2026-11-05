import { configuration } from '../config';
import { BusinessError } from '../domain/business-error';

export async function sendResendEmail(to: string, subject: string, text: string) {
  if (!configuration.resend.apiKey) throw new BusinessError(503, 'Configura RESEND_API_KEY para enviar correos');
  let response: Response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${configuration.resend.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: configuration.resend.from, to: [to], subject, text }),
      signal: AbortSignal.timeout(10000),
    });
  } catch { throw new BusinessError(502, 'No se pudo enviar el correo con Resend'); }
  const data = await response.json().catch(() => null) as { id?: string } | null;
  if (!response.ok || !data?.id) throw new BusinessError(502, 'Resend no aceptó el envío del correo');
  return data.id;
}
