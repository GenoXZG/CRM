import './common.js';
import { delegate, element, setField } from '../shared/dom.js';
import { showDialog } from '../shared/dialogs.js';
import { initializeLocationMaps } from '../shared/location-map.js';
import { requestJson } from '../shared/http.js';

initializeLocationMaps();

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
    refreshSelections();
  });
}
delegate(document, 'click', '.btn_tecnico_pendiente', () => {
  setField('id_tecnico', 'null');
  setField('nombre_tecnico', '');
  setField('numero_tecnico', '');
  refreshSelections();
});
function refreshSelections() {
  const client = element<HTMLInputElement>('id_cliente').value;
  element('ticket-select-client').textContent = client ? 'Cambiar cliente' : 'Seleccionar cliente';
  if (client) element('ticket-client-error').classList.add('d-none');
  const technician = element<HTMLInputElement>('id_tecnico').value;
  const assigned = Boolean(technician && technician !== 'null');
  element('ticket-select-technician').textContent = assigned ? 'Cambiar técnico' : 'Asignar técnico';
  element('ticket-remove-technician').classList.toggle('d-none', !assigned);
  element('ticket-technician-state').textContent = assigned ? 'Técnico seleccionado' : 'Pendiente de asignación';
}
refreshSelections();
element<HTMLFormElement>('ticket-create-form').addEventListener('submit', event => {
  if (element<HTMLInputElement>('id_cliente').value) return;
  event.preventDefault();
  element('ticket-client-error').classList.remove('d-none');
  window.bootstrap?.Modal.getOrCreateInstance(element('modalClientes')).show();
}, true);
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

const createForm = element<HTMLFormElement>('ticket-create-form');
const submit = createForm.querySelector<HTMLButtonElement>('button[type="submit"]')!;
const editable = element<HTMLFieldSetElement>('ticket-create-editable');
const initial = formValues();
let saving = false;
let leaving = false;
let created = false;
function formValues() {
  return JSON.stringify(Array.from(createForm.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea')).map(field => [field.id || field.name, field.value]));
}
export const ticketCreationDirty = () => formValues() !== initial;
export const ticketCreationBusy = () => saving;
createForm.addEventListener('submit', event => {
  if (event.defaultPrevented) return;
  if (saving) { event.preventDefault(); return; }
  if (createForm.dataset.embedded !== 'true') { leaving = true; saving = true; return; }
  event.preventDefault();
  const data = Object.fromEntries(new FormData(createForm).entries());
  const error = element('ticket-create-error');
  const back = document.getElementById('ticket-create-back');
  saving = true;
  editable.disabled = true;
  submit.disabled = true;
  if (back instanceof HTMLButtonElement) back.disabled = true;
  submit.textContent = 'Creando ticket…';
  createForm.setAttribute('aria-busy', 'true');
  error.classList.add('d-none');
  void requestJson<{ success: boolean; redirect: string }>('/add_ticket', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(data),
  }).then(result => {
    const destination = new URL(result.redirect, location.origin);
    if (destination.origin !== location.origin) throw new Error('Destino del ticket inválido.');
    created = true;
    leaving = true;
    location.replace(destination.pathname + destination.search);
  }).catch((failure: unknown) => {
    editable.disabled = false;
    error.textContent = failure instanceof Error ? failure.message : 'No se pudo crear el ticket. Intenta nuevamente.';
    error.classList.remove('d-none');
    error.focus();
  }).finally(() => {
    if (!leaving) {
      saving = false;
      editable.disabled = false;
      submit.disabled = false;
      if (back instanceof HTMLButtonElement) back.disabled = false;
      submit.textContent = 'Crear ticket';
      createForm.removeAttribute('aria-busy');
    }
  });
});
window.addEventListener('beforeunload', event => {
  if (!leaving && (saving || ticketCreationDirty())) { event.preventDefault(); event.returnValue = ''; }
});
window.addEventListener('pageshow', event => {
  if (!event.persisted) return;
  saving = false;
  editable.disabled = false;
  leaving = false;
  submit.disabled = false;
  submit.textContent = 'Crear ticket';
  createForm.removeAttribute('aria-busy');
  const back = document.getElementById('ticket-create-back');
  if (back instanceof HTMLButtonElement) back.disabled = false;
  if (created) {
    created = false;
    createForm.reset();
    refreshSelections();
    element('direccion_servicio').dispatchEvent(new Event('input', { bubbles: true }));
    document.dispatchEvent(new Event('ticket:created-return'));
  }
});
