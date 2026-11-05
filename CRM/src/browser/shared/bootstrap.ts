interface ModalInstance {
  show(): void;
  hide(): void;
}
interface TooltipInstance {
  dispose(): void;
}
interface BootstrapLibrary {
  Modal: { getOrCreateInstance(node: HTMLElement): ModalInstance };
  Tooltip: {
    getOrCreateInstance(node: HTMLElement): TooltipInstance;
    getInstance(node: HTMLElement): TooltipInstance | null;
  };
}
declare global {
  interface Window {
    bootstrap?: BootstrapLibrary;
  }
}
export function hideModal(id: string) {
  const node = document.getElementById(id);
  if (node) window.bootstrap?.Modal.getOrCreateInstance(node).hide();
}
export function refreshTooltips(root: HTMLElement, dispose = false) {
  for (const node of root.querySelectorAll<HTMLElement>('[data-bs-toggle="tooltip"]')) {
    if (dispose) window.bootstrap?.Tooltip.getInstance(node)?.dispose();
    else window.bootstrap?.Tooltip.getOrCreateInstance(node);
  }
}
