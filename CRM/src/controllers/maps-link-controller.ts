import type { Request, Response } from 'express';
import { respondError } from '../adapters/http-errors';
import { resolveMapsLink } from '../services/maps-link-service';

const attempts = new Map<string, { count: number; expires: number }>();
export async function resolveLocationLink(request: Request, response: Response) {
  response.setHeader('Cache-Control', 'no-store');
  const now = Date.now();
  for (const [key, value] of attempts) if (value.expires <= now) attempts.delete(key);
  const key = request.ip || 'unknown';
  const current = attempts.get(key) ?? { count: 0, expires: now + 60000 };
  if (current.count >= 30 || (!attempts.has(key) && attempts.size >= 4096)) {
    response.setHeader('Retry-After', '60');
    response.status(429).json({ success: false, error: 'Se alcanzó el límite de conversiones. Espera un minuto e intenta nuevamente.' });
    return;
  }
  current.count++;
  attempts.set(key, current);
  try {
    response.json({ success: true, data: await resolveMapsLink(request.body?.url) });
  } catch (error) { respondError(response, error); }
}
