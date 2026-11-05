import { BusinessError } from '../domain/business-error';
// This parser has no DOM dependencies and is compiled for both Node and the browser.
import { coordinatesFromLink, coordinatesLink, isShortMapsLink, type Coordinates } from '../browser/shared/location-coordinates';

interface ResolvedLocation extends Coordinates { normalizedUrl: string }
const cache = new Map<string, { result: ResolvedLocation; expires: number }>();
const pending = new Map<string, Promise<ResolvedLocation>>();
const MAX_PENDING = 4;

function allowedLink(value: string): URL {
  let url: URL;
  try { url = new URL(value); }
  catch { throw new BusinessError(400, 'Enlace de Google Maps inválido'); }
  const google = /^(?:www\.|maps\.)?google\.(?:com|com\.mx|es)$/.test(url.hostname);
  const mapsPath = /^\/maps(?:\/|$)/.test(url.pathname) || (url.hostname.startsWith('maps.google.') && url.pathname === '/');
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      (!isShortMapsLink(value) && !(google && mapsPath)))
    throw new BusinessError(400, 'Usa un enlace HTTPS de Google Maps o maps.app.goo.gl');
  return url;
}
async function followLink(initial: URL): Promise<ResolvedLocation> {
  const signal = AbortSignal.timeout(8000);
  const visited = new Set<string>();
  let current = initial;
  for (let hop = 0; hop <= 5; hop++) {
    const point = coordinatesFromLink(current.href);
    if (point) return { ...point, normalizedUrl: coordinatesLink(point) };
    if (visited.has(current.href)) throw new BusinessError(422, 'El enlace contiene redirecciones circulares');
    visited.add(current.href);
    let response: Response;
    try {
      response = await fetch(current, {
        redirect: 'manual', signal,
        headers: { 'User-Agent': 'CRM-LocationResolver/1.0', Accept: 'text/html' },
      });
    } catch {
      throw new BusinessError(signal.aborted ? 504 : 502, 'No fue posible resolver el enlace de Maps. Intenta nuevamente o selecciona el punto manualmente.');
    }
    const destination = response.headers.get('location');
    // Only redirect headers are needed; do not download or scrape Google's pages.
    await response.body?.cancel().catch(() => undefined);
    if (![301, 302, 303, 307, 308].includes(response.status)) {
      if (response.status >= 400)
        throw new BusinessError(422, 'Google no pudo abrir este enlace. Comprueba que sea válido y esté completo.');
      throw new BusinessError(422, 'El destino no contiene coordenadas precisas. Conserva el enlace o selecciona el punto manualmente.');
    }
    if (!destination || destination.length > 8192)
      throw new BusinessError(422, 'El enlace no devolvió un destino válido');
    try { current = allowedLink(new URL(destination, current).href); }
    catch { throw new BusinessError(422, 'El enlace redirige fuera de los dominios permitidos de Google Maps'); }
  }
  throw new BusinessError(422, 'El enlace contiene demasiadas redirecciones');
}

export function resolveMapsLink(value: unknown): Promise<ResolvedLocation> {
  if (typeof value !== 'string' || !value.trim() || value.length > 2048)
    throw new BusinessError(400, 'Enlace de Maps inválido o demasiado largo');
  const url = allowedLink(value.trim());
  url.hash = '';
  const point = coordinatesFromLink(url.href);
  if (point) return Promise.resolve({ ...point, normalizedUrl: coordinatesLink(point) });
  const key = url.href;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return Promise.resolve(cached.result);
  const running = pending.get(key);
  if (running) return running;
  if (pending.size >= MAX_PENDING)
    throw new BusinessError(429, 'Hay varias conversiones en curso. Intenta nuevamente en unos segundos.');
  const task = followLink(url).then(result => {
    if (cache.size >= 256) cache.delete(cache.keys().next().value!);
    cache.set(key, { result, expires: Date.now() + 30 * 60 * 1000 });
    return result;
  }).finally(() => { pending.delete(key); });
  pending.set(key, task);
  return task;
}
