import type { Request, Response } from 'express';
import { respondError } from '../adapters/http-errors';
import { RateLimit } from '../rate-limit';
import { sendTestEmail } from '../services/test-email-service';

const perAccount = new RateLimit(3, 60000);
const perInstance = new RateLimit(10, 60000);

export async function postTestEmail(request: Request, response: Response) {
  const wait = perAccount.consume(String(response.locals.currentUser.id_usuario)) || perInstance.consume('test-email');
  if (wait) return response.set('Retry-After', String(wait)).status(429).json({ error: 'Espera antes de enviar otro correo de prueba.' });
  try {
    const data = await sendTestEmail(request.body?.to);
    response.status(200).json({ success: true, message: 'El proveedor aceptó el correo de prueba', data });
  } catch (error) { respondError(response, error); }
}
