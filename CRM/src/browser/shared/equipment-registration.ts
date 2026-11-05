import { requestJson } from './http.js';

export interface RegisteredEquipment {
  ID_equipo: number;
  ID_equipo_modelo: number;
  IMEI: string | null;
  ID_modem: string | null;
  Estatus_equipo: string;
  Equipo_stock: { ID_equipo_modelo: number; Marca_equipo: string; Modelo_equipo: string };
}
let saving = false;
export const equipmentRegistrationBusy = () => saving;
export function equipmentRegistrationDirty() {
  const form = document.getElementById('equipment-create-form');
  return form instanceof HTMLFormElement && Array.from(form.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[name="id_equipo_modelo"], [name="imei"], [name="id_modem"]')).some(field => Boolean(field.value.trim()));
}
export function initializeEquipmentRegistration(onCreated: (device: RegisteredEquipment) => void) {
  const node = document.getElementById('equipment-create-form');
  if (!(node instanceof HTMLFormElement) || node.dataset.initialized === 'true') return;
  const form: HTMLFormElement = node;
  form.dataset.initialized = 'true';
  const fieldset = form.querySelector<HTMLFieldSetElement>('#equipment-create-fields')!;
  const model = form.querySelector<HTMLSelectElement>('#id_equipo_modelo')!;
  const search = form.querySelector<HTMLInputElement>('#equipment-model-search')!;
  const imei = form.querySelector<HTMLInputElement>('#imei')!;
  const modem = form.querySelector<HTMLInputElement>('#id_modem')!;
  const submit = form.querySelector<HTMLButtonElement>('#equipment-create-submit')!;
  const error = form.querySelector<HTMLElement>('#equipment-create-error')!;
  const label = submit.textContent;
  const models = Array.from(model.options).filter(option => option.value).map(option => ({ value: option.value, text: option.textContent ?? '' }));
  function filterModels() {
    const term = search.value.trim().toLocaleLowerCase('es');
    const selected = model.value;
    const matches = models.filter(option => option.text.toLocaleLowerCase('es').includes(term));
    model.replaceChildren(new Option('Selecciona un modelo', ''));
    for (const option of matches) model.add(new Option(option.text, option.value, false, option.value === selected));
    form.querySelector<HTMLElement>('#equipment-model-hint')!.textContent = models.length === 0 ? 'Primero registra una marca y modelo en Catálogos.' : matches.length ? `${matches.length} modelos disponibles.` : 'No hay modelos que coincidan con la búsqueda.';
  }
  search.addEventListener('input', filterModels);
  for (const input of [imei, modem]) input.addEventListener('input', () => input.setCustomValidity(''));
  // Avoid hiding a pending request and submitting the same device again.
  const modal = form.closest('.modal');
  modal?.addEventListener('hide.bs.modal', event => { if (saving) event.preventDefault(); });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (saving || document.body.dataset.ticketActionBusy === 'true') return;
    for (const input of [imei, modem]) {
      input.value = input.value.trim();
      input.setCustomValidity(input.value ? '' : 'Completa este identificador.');
    }
    if (!form.reportValidity()) return;
    const body = { id_equipo_modelo: model.value, imei: imei.value, id_modem: modem.value };
    saving = true;
    fieldset.disabled = true;
    error.classList.add('d-none');
    submit.textContent = 'Guardando…';
    let created = false;
    void requestJson<{ success: boolean; data: RegisteredEquipment }>('/add_equipo', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body),
    }).then(result => {
      created = true;
      form.reset();
      filterModels();
      saving = false;
      onCreated(result.data);
    }).catch((failure: unknown) => {
      error.textContent = created ? 'El equipo se registró, pero no se pudo seleccionar. Consulta Inventario antes de volver a registrarlo.' : failure instanceof Error ? failure.message : 'No se pudo registrar el equipo. Intenta nuevamente.';
      error.classList.remove('d-none');
    }).finally(() => {
      saving = false;
      fieldset.disabled = false;
      submit.disabled = models.length === 0;
      submit.textContent = label;
    });
  });
}
