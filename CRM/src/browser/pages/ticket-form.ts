import './common.js';
import { delegate, element, setField } from '../shared/dom.js';
import { showDialog } from '../shared/dialogs.js';

const selections = [
  {
    selector: '.btn_confirmar_cliente',
    fields: {
      id_cliente: 'id',
      nombre_cliente: 'nombre',
      encargado: 'encargado',
      telefono_cliente: 'numero',
    },
  },
  {
    selector: '.btn_confirmar_tecnico',
    fields: { id_tecnico: 'id', nombre_tecnico: 'nombre', numero_tecnico: 'numero' },
  },
];
for (const selection of selections) {
  delegate(document, 'click', selection.selector, (button) => {
    for (const [field, key] of Object.entries(selection.fields))
      setField(field, button.dataset[key] ?? '');
  });
}
delegate(document, 'click', '.btn_tecnico_pendiente', () => {
  setField('id_tecnico', 'null');
  setField('nombre_tecnico', 'Pendiente');
  setField('numero_tecnico', '#');
});
document.getElementById('btn_ubicacion_pendiente')?.addEventListener('click', () => {
  const location = element<HTMLInputElement>('direccion_servicio');
  location.value = 'Pendiente';
  location.focus();
});
element<HTMLInputElement>('numero_unidades').addEventListener('input', (event) => {
  const input = event.currentTarget as HTMLInputElement;
  input.value = input.value.replace(/^0+(?=\d)/, '');
});
// datetime-local expects the local wall clock, not UTC.
const now = new Date();
element<HTMLInputElement>('fecha').min = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  .toISOString()
  .slice(0, 16);
const notice = document.getElementById('ticket-notice');
if (notice) {
  void showDialog({
    title: notice.dataset.title ?? '',
    text: notice.dataset.message ?? '',
    icon: 'error',
  }).then(() => {
    const modal = document.getElementById('modalClientes');
    if (modal) window.bootstrap?.Modal.getOrCreateInstance(modal).show();
  });
}
