export function element<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing page element: ${id}`);
  return node as T;
}

export function delegate(
  root: Document | HTMLElement,
  eventName: string,
  selector: string,
  handler: (target: HTMLElement, event: Event) => void,
) {
  root.addEventListener(eventName, (event) => {
    const target = event.target instanceof Element ? event.target.closest(selector) : null;
    if (target instanceof HTMLElement && root.contains(target)) handler(target, event);
  });
}

export function setField(id: string, value: string) {
  const node = element(id);
  if (node instanceof HTMLInputElement || node instanceof HTMLSelectElement) node.value = value;
  else node.textContent = value;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character] ?? character;
  });
}
