import type { Request, Response } from 'express';
import { configuration } from './config';

const paths = {
  crm_pending: '/login',
  crm_session: '/',
  crm_recovery: '/login/recuperar',
};

export function readCookie(request: Request, name: string): string | undefined {
  const prefix = name + '=';
  return request.headers.cookie?.split(';').map(part => part.trim())
    .find(part => part.startsWith(prefix))?.slice(prefix.length);
}

export function authCookieValue(request: Request, name: string): string | null {
  const value = readCookie(request, name);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}

export function useSecureAuthCookie(request: Request) {
  return configuration.auth.cookieSecure || request.secure;
}

export function setAuthCookie(request: Request, response: Response, name: keyof typeof paths, value: string, maxAge: number) {
  const secure = useSecureAuthCookie(request);
  response.append('Set-Cookie', `${name}=${value}; HttpOnly; SameSite=Lax; Path=${paths[name]}; Max-Age=${maxAge}${secure ? '; Secure' : ''}`);
}
