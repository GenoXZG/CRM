import { randomBytes } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { configuration } from './config';

export function securityHeaders(request: Request, response: Response, next: NextFunction) {
  const nonce = randomBytes(18).toString('base64');
  response.locals.cspNonce = nonce;
  response.set({
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self), payment=(), usb=()',
  });
  if (configuration.deployment === 'public' && request.secure)
    response.set('Strict-Transport-Security', 'max-age=31536000');

  const policy = [
    "default-src 'none'",
    `script-src 'self' 'nonce-${nonce}'`,
    "script-src-attr 'none'",
    `style-src 'self' 'nonce-${nonce}' https://cdn.jsdelivr.net https://cdn.lineicons.com https://fonts.googleapis.com`,
    "style-src-attr 'unsafe-inline'",
    `img-src 'self' data: blob: ${configuration.maps.tileOrigin}`,
    "font-src 'self' https://cdn.jsdelivr.net https://cdn.lineicons.com https://fonts.gstatic.com",
    "connect-src 'self'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
  ].join('; ');
  response.set(configuration.cspMode === 'enforce' ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only', policy);
  next();
}
