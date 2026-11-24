import { escapeHtml } from './dom.js';

const entities: Record<string, string> = {
  copy: '©', amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'",
};

function text(value: string): string {
  return value.replace(/&(copy|amp|lt|gt|quot|#39);/g, (entity, name: string) => entities[name] ?? entity);
}

// Leaflet expects HTML. Recognize simple links and render everything else as text.
export function safeMapAttribution(value: string): string {
  let offset = 0;
  let result = '';
  for (const link of value.matchAll(/<a\s+href=(["'])([^"'<>]+)\1\s*>([^<>]*)<\/a>/gi)) {
    const start = link.index!;
    result += escapeHtml(text(value.slice(offset, start)));
    const label = escapeHtml(text(link[3]!));
    let href: string | undefined;
    try {
      const url = new URL(text(link[2]!));
      if (url.protocol === 'https:' && !url.username && !url.password) href = url.href;
    } catch { /* Keep the label without a link if the URL is invalid. */ }
    result += href ? `<a href="${escapeHtml(href)}">${label}</a>` : label;
    offset = start + link[0].length;
  }
  return result + escapeHtml(text(value.slice(offset)));
}
