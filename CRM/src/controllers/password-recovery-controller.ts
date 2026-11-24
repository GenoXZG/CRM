import type { Request, Response, NextFunction } from 'express';
import { rotateCsrf } from '../csrf';
import { setAuthCookie } from '../auth-cookies';
import { emailFormat } from '../auth';
import { accountAtNetwork, authLimits, clientNetwork } from '../rate-limit';
import { performance } from 'node:perf_hooks';
import { setTimeout } from 'node:timers/promises';
import { openRecoveryToken, sealRecoveryToken } from '../recovery-cookie';
import { requestPasswordRecovery, resetPassword } from '../services/password-recovery-service';

const render = (response: Response, step: string, error: string | null = null, status = 200) => response.status(status).render('password-recovery', { step, error });
async function waitForRecoveryResponse(started: number) {
  const remaining = 150 - (performance.now() - started);
  if (remaining > 0) await setTimeout(Math.ceil(remaining));
}
function limitRecovery(response: Response, step: string, retry: number) {
  response.setHeader('Retry-After', String(retry));
  return render(response, step, 'Demasiadas solicitudes. Espera antes de volver a intentarlo.', 429);
}
export function showRecovery(_request: Request, response: Response) { return render(response, 'request'); }
export function showReset(request: Request, response: Response) {
  return openRecoveryToken(request) ? render(response, 'reset') : response.redirect('/login/recuperar');
}
export async function sendRecovery(request: Request, response: Response, next: NextFunction) {
  const started = performance.now();
  const network = clientNetwork(request.ip);
  const ipRetry = authLimits.recoveryIp.consume(network);
  if (ipRetry) return limitRecovery(response, 'request', ipRetry);
  const email = typeof request.body?.correo === 'string' ? request.body.correo.trim().toLowerCase() : '';
  if (!emailFormat.test(email) || email.length > 254) return render(response, 'request', 'Ingresa un correo válido.', 400);
  const accountRetry = authLimits.recoveryAccountIp.consume(accountAtNetwork(network, email));
  if (accountRetry) return limitRecovery(response, 'request', accountRetry);
  try {
    const previous = openRecoveryToken(request);
    const recoveryToken = await requestPasswordRecovery(email, previous);
    await waitForRecoveryResponse(started);
    setAuthCookie(request, response, 'crm_recovery', sealRecoveryToken(recoveryToken), 600);
    rotateCsrf(request, response);
    return response.redirect('/login/recuperar/restablecer');
  } catch (error) { next(error); }
}
export async function completeRecovery(request: Request, response: Response, next: NextFunction) {
  const started = performance.now();
  const retry = authLimits.resetIp.consume(clientNetwork(request.ip));
  if (retry) return limitRecovery(response, 'reset', retry);
  const password = typeof request.body?.password === 'string' ? request.body.password : '';
  const confirm = request.body?.confirmPassword;
  const code = typeof request.body?.code === 'string' ? request.body.code.trim() : '';
  if (password.length < 12 || password.length > 1024) return render(response, 'reset', 'La contraseña debe tener entre 12 y 1024 caracteres.', 400);
  if (password !== confirm) return render(response, 'reset', 'Las contraseñas no coinciden.', 400);
  try {
    const pending = openRecoveryToken(request);
    const result = pending ? await resetPassword(pending, code, password) : 'expired';
    if (result !== 'ok') {
      await waitForRecoveryResponse(started);
      return render(response, 'reset', 'No se pudo verificar el código. Compruébalo o solicita uno nuevo.', 400);
    }
    setAuthCookie(request, response, 'crm_recovery', '', 0);
    // Recovery does not sign the browser in or bypass the usual second factor.
    setAuthCookie(request, response, 'crm_session', '', 0);
    setAuthCookie(request, response, 'crm_pending', '', 0);
    rotateCsrf(request, response, { session: null, pending: null, recovery: null });
    return render(response, 'success');
  } catch (error) { next(error); }
}
