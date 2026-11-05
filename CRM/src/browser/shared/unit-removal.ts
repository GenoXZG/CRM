import { showDialog } from './dialogs.js';
import { postJson } from './http.js';

export async function confirmUnitRemoval(ticketId: string, unitId: string, label: string, hasUnsavedChanges = false) {
  const confirmed = await showDialog({
    title: '¿Quitar unidad del ticket?',
    text: `Se retirará la unidad ${label} y se reducirá en uno la cantidad prevista del ticket #${ticketId}. Su equipo quedará disponible y se quitarán sus vínculos con accesorios.${hasUnsavedChanges ? ' Se descartarán las selecciones de equipos y accesorios que aún no has guardado.' : ''}`,
    icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí, quitar unidad', cancelButtonText: 'Conservar unidad',
  });
  if (!confirmed) return false;
  await postJson(`/tickets/${encodeURIComponent(ticketId)}/unidades/${encodeURIComponent(unitId)}/quitar`, {});
  document.dispatchEvent(new Event('assignment:saved'));
  location.reload();
  return true;
}
