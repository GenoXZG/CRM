import type { Request, Response, NextFunction } from 'express';
import { setAuthCookie } from '../auth-cookies';
import { emailFormat } from '../auth';
import { requestPasswordRecovery, resetPassword } from '../services/password-recovery-service';

const attempts = new Map<string, { count: number; until: number }>();
function limited(request: Request, action: string, max: number) {
  const now = Date.now();
  for (const [key, entry] of attempts) if (entry.until <= now) attempts.delete(key);
  const key = `${action}:${request.ip ?? 'unknown'}`;
  const entry = attempts.get(key);
  if (entry) return ++entry.count > max;
  if (attempts.size >= 4096) return true;
  attempts.set(key, { count: 1, until: now + 15 * 60 * 1000 });
  return false;
}
function token(request: Request) {
  const value = (request.headers.cookie ?? '').split(';').map(part => part.trim()).find(part => part.startsWith('crm_recovery='))?.slice('crm_recovery='.length);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}
const render = (response: Response, step: string, error: string | null = null, status = 200) => response.status(status).render('password-recovery', { step, error });
export function showRecovery(_request: Request, response: Response) { return render(response, 'request'); }
export function showReset(request: Request, response: Response) {
  return token(request) ? render(response, 'reset') : response.redirect('/login/recuperar');
}
export async function sendRecovery(request: Request, response: Response, next: NextFunction) {
  if (limited(request, 'request', 5)) {
    response.setHeader('Retry-After', '900');
    return render(response, 'request', 'Demasiadas solicitudes. Intenta nuevamente en 15 minutos.', 429);
  }
  const email = typeof request.body?.correo === 'string' ? request.body.correo.trim().toLowerCase() : '';
  if (!emailFormat.test(email) || email.length > 254) return render(response, 'request', 'Ingresa un correo válido.', 400);
  try {
    setAuthCookie(request, response, 'crm_recovery', await requestPasswordRecovery(email, token(request)), 600);
    return response.redirect('/login/recuperar/restablecer');
  } catch (error) { next(error); }
}
export async function completeRecovery(request: Request, response: Response, next: NextFunction) {
  if (limited(request, 'reset', 20)) {
    response.setHeader('Retry-After', '900');
    return render(response, 'reset', 'Demasiados intentos. Intenta nuevamente en 15 minutos.', 429);
  }
  const password = typeof request.body?.password === 'string' ? request.body.password : '';
  const confirm = request.body?.confirmPassword;
  const code = typeof request.body?.code === 'string' ? request.body.code.trim() : '';
  if (password.length < 12 || password.length > 1024) return render(response, 'reset', 'La contraseña debe tener entre 12 y 1024 caracteres.', 400);
  if (password !== confirm) return render(response, 'reset', 'Las contraseñas no coinciden.', 400);
  try {
    const pending = token(request);
    const result = pending ? await resetPassword(pending, code, password) : 'expired';
    if (result === 'invalid') return render(response, 'reset', 'Código incorrecto. Revisa el correo e intenta nuevamente.', 400);
    setAuthCookie(request, response, 'crm_recovery', '', 0);
    if (result === 'expired') return render(response, 'request', 'El código caducó, fue reemplazado o agotó sus intentos. Solicita uno nuevo.', 400);
    // Recovery does not sign the browser in or bypass the usual second factor.
    setAuthCookie(request, response, 'crm_session', '', 0);
    setAuthCookie(request, response, 'crm_pending', '', 0);
    return render(response, 'success');
  } catch (error) { next(error); }
}
