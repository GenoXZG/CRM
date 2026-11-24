import type { Request, Response } from 'express';
import { configuration } from './config';

const paths = {
  crm_pending: '/login',
  crm_session: '/',
  crm_recovery: '/login/recuperar',
};

export function setAuthCookie(request: Request, response: Response, name: keyof typeof paths, value: string, maxAge: number) {
  const secure = configuration.auth.cookieSecure || request.secure;
  response.append('Set-Cookie', `${name}=${value}; HttpOnly; SameSite=Lax; Path=${paths[name]}; Max-Age=${maxAge}${secure ? '; Secure' : ''}`);
}
