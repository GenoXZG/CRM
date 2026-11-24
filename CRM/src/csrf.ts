import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { authCookieValue, useSecureAuthCookie } from './auth-cookies';
import { BusinessError } from './domain/business-error';
import { recoveryCookieValue } from './recovery-cookie';

const signingKey = randomBytes(32);
const tokenFormat = /^[a-f0-9]{64}$/;
const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
const uploadRoute = /^\/tickets\/[^/]+\/subir-fotos\/?$/;

type AuthState = { session?: null; pending?: null; recovery?: null };

function sign(request: Request, nonce: string, state: AuthState = {}) {
  return createHmac('sha256', signingKey).update([
    nonce,
    'session' in state ? null : authCookieValue(request, 'crm_session'),
    'pending' in state ? null : authCookieValue(request, 'crm_pending'),
    'recovery' in state ? null : recoveryCookieValue(request),
  ].join(':')).digest('hex');
}

function nonceCookieName(secure: boolean) {
  return secure ? '__Host-crm_csrf' : 'crm_csrf';
}

export function rotateCsrf(request: Request, response: Response, state?: AuthState) {
  const secure = useSecureAuthCookie(request);
  const nonce = randomBytes(32).toString('hex');
  response.append('Set-Cookie', `${nonceCookieName(secure)}=${nonce}; HttpOnly; SameSite=Lax; Path=/${secure ? '; Secure' : ''}`);
  response.locals.csrfToken = sign(request, nonce, state);
}

function sameOrigin(request: Request): boolean {
  const origin = request.get('origin');
  const referer = request.get('referer');
  const expected = `${request.protocol}://${request.get('host')}`;
  try {
    return (origin === undefined || origin === new URL(expected).origin) &&
      (referer === undefined || new URL(referer).origin === new URL(expected).origin);
  } catch {
    return false;
  }
}

export class CsrfError extends BusinessError {
  constructor() { super(403, 'Token de seguridad inválido. Recarga la página e inténtalo de nuevo.'); }
}

export function assertCsrf(request: Request, response: Response) {
  const expected: string | undefined = response.locals.csrfToken;
  const received: unknown = request.get('x-csrf-token') ?? request.body?._csrf;
  if (!expected || typeof received !== 'string' || !tokenFormat.test(received) ||
      !timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(received, 'hex')))
    throw new CsrfError();
}

export function csrfProtection(request: Request, response: Response, next: NextFunction) {
  const safe = safeMethods.has(request.method);
  if (!safe && !sameOrigin(request)) {
    response.set('Cache-Control', 'no-store');
    return response.status(403).json({ error: 'Origen no permitido.' });
  }

  // Assets and health checks do not render forms or issue credentials.
  if (safe && (request.method !== 'GET' || /^\/(css|js|assets|bootstrap|leaflet)\//i.test(request.path) ||
      request.path === '/favicon.ico' || request.path === '/health')) return next();

  const nonce = authCookieValue(request, nonceCookieName(useSecureAuthCookie(request)));
  if (nonce) response.locals.csrfToken = sign(request, nonce);
  else if (safe) rotateCsrf(request, response);
  // A native upload supplies the hidden field before its file parts. The route
  // validates it before Multer writes any file.
  if (!safe && !(request.method === 'POST' && uploadRoute.test(request.path) && request.is('multipart/form-data'))) {
    try { assertCsrf(request, response); }
    catch (error) { return next(error); }
    if (request.body && Object.hasOwn(request.body, '_csrf')) delete request.body._csrf;
  }
  next();
}
