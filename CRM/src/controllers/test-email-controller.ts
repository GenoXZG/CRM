import type { Request, Response } from 'express';
import { respondError } from '../adapters/http-errors';
import { sendTestEmail } from '../services/test-email-service';

export async function postTestEmail(request: Request, response: Response) {
  try {
    const data = await sendTestEmail(request.body?.to);
    response.status(200).json({ success: true, message: 'El proveedor aceptó el correo de prueba', data });
  } catch (error) { respondError(response, error); }
}
