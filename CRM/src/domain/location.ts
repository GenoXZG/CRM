import { BusinessError, nullableText } from './business-error';

export function safeLocationLink(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function locationUrl(value: unknown): string | null {
  const url = nullableText(value, 'Ubicación', 255)?.trim() || null;
  if (!url || url === 'Pendiente') return null;
  if (safeLocationLink(url)) return url;
  throw new BusinessError(400, 'La ubicación debe ser un enlace HTTP o HTTPS válido');
}
