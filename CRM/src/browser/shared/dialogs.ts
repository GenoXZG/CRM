export type DialogIcon = 'success' | 'error' | 'warning' | 'info' | 'question';
export interface DialogOptions {
  title: string;
  text?: string;
  icon?: DialogIcon;
  showCancelButton?: boolean;
  confirmButtonText?: string;
  cancelButtonText?: string;
}
interface DialogLibrary {
  fire(options: DialogOptions): Promise<{ isConfirmed: boolean }>;
}
declare global {
  interface Window {
    Swal?: DialogLibrary;
  }
}
export async function showDialog(options: DialogOptions): Promise<boolean> {
  if (window.Swal) return (await window.Swal.fire(options)).isConfirmed;
  const message = [options.title, options.text].filter(Boolean).join('\n');
  if (options.showCancelButton) return window.confirm(message);
  window.alert(message);
  return true;
}
export function showError(error: unknown) {
  return showDialog({
    title: 'Error',
    text: error instanceof Error ? error.message : 'No se pudo completar la operación.',
    icon: 'error',
  });
}
