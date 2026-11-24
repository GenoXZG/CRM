import { showDialog } from './dialogs.js';
import { postJson } from './http.js';

export async function confirmUnitRemoval(ticketId: string, unitId: string, label: string, hasUnsavedChanges = false, lastUnit = false) {
  const consequence = lastUnit
    ? `Es la última unidad registrada. El ticket #${ticketId} volverá a «En espera» y quedará una unidad prevista por registrar.`
    : `Se reducirá en uno la cantidad prevista del ticket #${ticketId}.`;
  const confirmed = await showDialog({
    title: '¿Quitar unidad del ticket?',
    text: `Se retirará la unidad ${label}. ${consequence} Su equipo quedará disponible y se quitarán sus vínculos con accesorios.${hasUnsavedChanges ? ' Se descartarán las selecciones de equipos y accesorios que aún no has guardado.' : ''}`,
    icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí, quitar unidad', cancelButtonText: 'Conservar unidad',
  });
  if (!confirmed) return false;
  const result = await postJson<{ registrationPending: boolean; message: string }>(`/tickets/${encodeURIComponent(ticketId)}/unidades/${encodeURIComponent(unitId)}/quitar`, {});
  if (result.registrationPending)
    await showDialog({ title: 'Ticket en espera', text: result.message, icon: 'info' });
  document.dispatchEvent(new Event('assignment:saved'));
  location.reload();
  return true;
}
