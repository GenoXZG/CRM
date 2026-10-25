export async function requestJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new Error('No se pudo conectar con el servidor. Intente nuevamente.');
  }
  const data: unknown = await response.json().catch(() => null);
  const record = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
  if (!response.ok || record.success === false) {
    throw new Error(String(record.error || record.message || `Error HTTP ${response.status}`));
  }
  if (data === null) throw new Error('El servidor devolvió una respuesta inválida.');
  return data as T;
}

export function postJson<T>(url: string, body: unknown): Promise<T> {
  return requestJson<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Only successful catalog responses are cached; failed requests can be retried.
export function createRequestCache<T>() {
  const cache = new Map<string, Promise<T>>();
  return (url: string): Promise<T> => {
    const existing = cache.get(url);
    if (existing) return existing;
    const pending = requestJson<T>(url).catch((error: unknown) => {
      cache.delete(url);
      throw error;
    });
    cache.set(url, pending);
    return pending;
  };
}
