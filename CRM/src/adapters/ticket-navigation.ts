const filterKeys = new Set(['attention', 'search', 'status', 'client', 'technician', 'dateFrom', 'dateTo', 'page', 'size']);

export function ticketListReturn(value: unknown): string {
  if (typeof value !== 'string' || value.length > 4096 || !value.startsWith('/tickets')) return '/tickets';
  try {
    const url = new URL(value, 'http://localhost');
    if (url.origin !== 'http://localhost' || url.pathname !== '/tickets') return '/tickets';
    const params = new URLSearchParams();
    for (const [key, entry] of url.searchParams) if (filterKeys.has(key)) params.set(key, entry.slice(0, 255));
    return params.size ? `/tickets?${params}` : '/tickets';
  } catch { return '/tickets'; }
}

export function ticketDetailsDestination(id: number | string, returnTo: unknown): string {
  const back = ticketListReturn(returnTo);
  return `/detalle_ticket/${id}${back === '/tickets' ? '' : `?returnTo=${encodeURIComponent(back)}`}`;
}
