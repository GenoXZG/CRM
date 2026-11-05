import { BusinessError, nullableText } from './business-error';

export function locationUrl(value: unknown): string | null {
  const url = nullableText(value, 'Ubicación', 255)?.trim() || null;
  if (!url || url === 'Pendiente') return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return url;
  } catch { /* Report a business error for malformed links. */ }
  throw new BusinessError(400, 'La ubicación debe ser un enlace HTTP o HTTPS válido');
}
