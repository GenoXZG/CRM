import './common.js';
import { element } from '../shared/dom.js';
import { requestJson } from '../shared/http.js';
import { showDialog, showError } from '../shared/dialogs.js';
import { equipmentRegistrationDirty, equipmentRegistrationBusy, initializeEquipmentRegistration } from '../shared/equipment-registration.js';

let leaving = false;
initializeEquipmentRegistration(device => {
  const state = document.querySelector<HTMLInputElement>('[name="inventoryState"]')?.value ?? '/inventario';
  const url = new URL(state, location.origin);
  url.searchParams.set('created', String(device.ID_equipo));
  leaving = true;
  location.assign(url.pathname + url.search);
});
window.addEventListener('beforeunload', event => {
  if (!leaving && (equipmentRegistrationDirty() || equipmentRegistrationBusy() || mutationBusy || editDirty())) { event.preventDefault(); event.returnValue = ''; }
});
element<HTMLSelectElement>('inventory-size').addEventListener('change', () => element<HTMLFormElement>('inventory-filters').requestSubmit());
const brand = element<HTMLSelectElement>('inventory-brand');
const model = element<HTMLSelectElement>('inventory-model');
const models = Array.from(model.options).filter(option => option.value).map(option => ({ value: option.value, text: option.textContent ?? '', brand: option.dataset.brand ?? '' }));
brand.addEventListener('change', () => {
  const selected = model.value;
  model.replaceChildren(new Option('Todos los modelos', ''));
  for (const option of models.filter(option => !brand.value || option.brand === brand.value)) model.add(new Option(option.text, option.value, false, option.value === selected));
});

let mutationBusy = false;
let editingId = '';
let originalValues = '';
const editForm = element<HTMLFormElement>('equipment-edit-form');
const editModel = element<HTMLSelectElement>('equipment-edit-model');
const editImei = element<HTMLInputElement>('equipment-edit-imei');
const editModem = element<HTMLInputElement>('equipment-edit-modem');
const editFields = element<HTMLFieldSetElement>('equipment-edit-fields');
const editSave = element<HTMLButtonElement>('equipment-edit-save');
const editError = element<HTMLElement>('equipment-edit-error');
const values = () => JSON.stringify([editModel.value, editImei.value, editModem.value]);
function editDirty() { return Boolean(editingId) && values() !== originalValues; }
function refreshInventory(result: string) {
  const url = new URL(location.href);
  url.searchParams.delete('created');
  url.searchParams.set('result', result);
  leaving = true;
  location.assign(url.pathname + url.search);
}
document.querySelectorAll<HTMLButtonElement>('[data-equipment-edit]').forEach(button => {
  button.addEventListener('click', () => {
    editingId = button.dataset.equipmentEdit ?? '';
    editModel.value = button.dataset.model ?? '';
    editImei.value = button.dataset.imei ?? '';
    editModem.value = button.dataset.modem ?? '';
    originalValues = values();
    element<HTMLElement>('equipment-edit-title').textContent = `Editar equipo #${editingId}`;
    element<HTMLElement>('equipment-edit-warning').textContent = button.dataset.linked === 'true'
      ? 'Este equipo está asignado a una unidad y no se puede eliminar. Puedes corregir sus datos; se conservarán su estado y su asignación.'
      : 'Puedes corregir los datos capturados. No se puede eliminar un equipo mientras esté asignado a una unidad.';
    editError.classList.add('d-none');
  });
});
element<HTMLElement>('modalEditarEquipo').addEventListener('hide.bs.modal', event => {
  if (mutationBusy || (editDirty() && !window.confirm('Hay cambios sin guardar. ¿Deseas descartarlos?'))) {
    event.preventDefault();
    return;
  }
  editingId = '';
});
editForm.addEventListener('submit', event => {
  event.preventDefault();
  if (mutationBusy || !editingId || !editForm.reportValidity()) return;
  mutationBusy = true;
  editFields.disabled = true;
  editSave.disabled = true;
  editSave.textContent = 'Guardando…';
  editError.classList.add('d-none');
  void requestJson(`/equipos/${editingId}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_equipo_modelo: editModel.value, imei: editImei.value.trim(), id_modem: editModem.value.trim() }),
  }).then(() => refreshInventory('updated')).catch((error: unknown) => {
    editError.textContent = error instanceof Error ? error.message : 'No se pudo actualizar el equipo.';
    editError.classList.remove('d-none');
  }).finally(() => {
    mutationBusy = false;
    editFields.disabled = false;
    editSave.disabled = false;
    editSave.textContent = 'Guardar cambios';
  });
});
document.querySelectorAll<HTMLButtonElement>('[data-equipment-delete]').forEach(button => {
  button.addEventListener('click', () => {
    if (mutationBusy || equipmentRegistrationBusy()) return;
    mutationBusy = true;
    void (async () => {
      try {
        if (!await showDialog({ title: `¿Eliminar equipo #${button.dataset.equipmentDelete}?`, text: 'Esta acción es permanente. Solo se puede eliminar si no está asignado a ninguna unidad.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar' })) return;
        button.disabled = true;
        await requestJson(`/equipos/${button.dataset.equipmentDelete}`, { method: 'DELETE' });
        refreshInventory('deleted');
      } catch (error) { await showError(error); }
      finally { mutationBusy = false; button.disabled = false; }
    })();
  });
});
