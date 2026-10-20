import './common.js';
import { delegate, element, escapeHtml } from '../shared/dom.js';
import { hideModal, refreshTooltips } from '../shared/bootstrap.js';
import { showDialog, showError } from '../shared/dialogs.js';
import { postJson, requestJson } from '../shared/http.js';
import { confirmUnitRemoval } from '../shared/unit-removal.js';
import { AssignmentState } from '../state/equipment-assignment.js';

interface UnitResponse {
  ID_Unidad: number;
  Placa_unidad: string;
  Vin_unidad: string;
  Unidad_stock: { Modelo_unidad: string; Marca_unidad: string } | null;
  Equipo: { ID_equipo: number; IMEI: string; Equipo_stock?: { Modelo_equipo: string } } | null;
  Accesorio_stocks: { ID_accesorio_modelo: number; Nombre_accesorio: string }[];
}
const state = new AssignmentState();
const container = element('contenedor-unidades-equipos');
const workbench = element('workbench-container');
const loading = element('loading-indicator');
const saveButton = element<HTMLButtonElement>('btn_confirmar_asignaciones');
let selectedTicket = '';
let unitCount = 0;
let selectionVersion = 0;
let pendingRequest: AbortController | undefined;
let saving = false;
const embedded = document.body.dataset.ticketWorkspace === 'true';
function actionBusy() { return saving || document.body.dataset.ticketActionBusy === 'true'; }

export const equipmentAssignmentBusy = () => saving;
export function equipmentAssignmentDirty() {
  return Array.from(state.equipment.keys()).some(id => !state.lockedUnits.has(id)) ||
    Array.from(state.accessories.values()).some(items => items.some(item => !item.readOnly));
}
export function resetEquipmentAssignment() {
  pendingRequest?.abort();
  selectionVersion++;
  selectedTicket = '';
  state.reset();
  refreshTooltips(container, true);
  container.replaceChildren();
  workbench.classList.add('d-none');
  loading.classList.add('d-none');
  saveButton.disabled = true;
}
function updateProgress() {
  const persisted = state.lockedUnits.size;
  const pending = state.equipment.size - persisted;
  element('assignment-progress').textContent = `Equipos guardados: ${persisted} de ${unitCount} unidades.${pending ? ` ${pending} equipo(s) por guardar.` : ''}`;
  saveButton.disabled = !equipmentAssignmentDirty();
}

export async function selectEquipmentTicket(button: HTMLElement) {
  for (const id of ['modalSeleccionEquipo', 'modalSeleccionAccesorio']) {
    hideModal(id);
    delete element(id).dataset.unitId;
  }
  pendingRequest?.abort();
  pendingRequest = new AbortController();
  const version = ++selectionVersion;
  selectedTicket = button.dataset.id_ticket ?? '';
  unitCount = Number(button.dataset.num_unidades) || 0;
  state.reset();
  element<HTMLAnchorElement>('btn_ver_detalles').href = `/detalle_ticket/${selectedTicket}`;
  workbench.classList.add('d-none');
  loading.classList.remove('d-none');
  if (!embedded) loading.scrollIntoView({ behavior: 'smooth' });
  saveButton.disabled = true;
  try {
    const units = await requestJson<UnitResponse[]>(`/unidades-por-ticket/${selectedTicket}`, {
      signal: pendingRequest.signal,
    });
    if (version !== selectionVersion) return;
    refreshTooltips(container, true);
    container.replaceChildren();
    if (!units.length) container.textContent = 'No hay unidades registradas en este ticket.';
    const fragment = document.createDocumentFragment();
    for (const unit of units) {
      const id = String(unit.ID_Unidad);
      if (unit.Equipo) state.assign(id, String(unit.Equipo.ID_equipo), true);
      for (const accessory of unit.Accesorio_stocks ?? []) {
        state.addAccessory(id, {
          id: String(accessory.ID_accesorio_modelo),
          name: accessory.Nombre_accesorio,
          readOnly: true,
        });
      }
      fragment.append(renderUnit(unit));
    }
    container.append(fragment);
    for (const unit of units) renderAccessories(String(unit.ID_Unidad));
    refreshTooltips(container);
    workbench.classList.remove('d-none');
    saveButton.hidden = false;
    updateProgress();
    return { total: units.length, equipped: state.lockedUnits.size };
  } catch (error) {
    if (
      version === selectionVersion &&
      !(error instanceof DOMException && error.name === 'AbortError')
    )
      throw error;
  } finally {
    if (version === selectionVersion) loading.classList.add('d-none');
  }
}

function renderEquipmentInfo(model: string, imei: string) {
  return `<div class="d-flex align-items-center mb-1"><i class="bi bi-hdd-network-fill text-primary me-2"></i>
    <span class="fw-bold text-dark small">${escapeHtml(model)}</span></div>
    <div class="small text-muted">IMEI: ${escapeHtml(imei)}</div>`;
}

function renderUnit(unit: UnitResponse) {
  const id = String(unit.ID_Unidad);
  const assigned = Boolean(unit.Equipo);
  const column = document.createElement('div');
  column.className = 'col-12 mb-3';
  column.innerHTML = `
    <div class="soft-card h-100 p-0 overflow-hidden unit-card ${assigned ? 'assigned' : 'pending'}" id="unidad-row-${id}">
      <div class="row g-0 h-100">
        <div class="col-md-6 p-4 bg-light d-flex flex-column justify-content-center border-end">
          <h5 class="mb-3"><i class="bi bi-car-front-fill me-2 text-secondary"></i>${escapeHtml(unit.Unidad_stock?.Modelo_unidad ?? 'N/D')}</h5>
          <div class="fw-bold text-dark mb-3">${escapeHtml(unit.Unidad_stock?.Marca_unidad ?? 'N/D')}</div>
          <div class="small text-muted mb-1">IDENTIFICADORES</div>
          <div class="font-monospace bg-white p-2 rounded border mb-1 small">${escapeHtml(unit.Placa_unidad || 'S/P')}</div>
          <div class="font-monospace bg-white p-2 rounded border small">${escapeHtml(unit.Vin_unidad || 'S/V')}</div>
          <button type="button" class="btn btn-outline-danger align-self-start mt-3" data-action="remove-saved-unit" ${unitCount <= 1 ? 'disabled title="El ticket debe conservar al menos una unidad"' : ''} data-unit-id="${id}" data-unit-label="${escapeHtml(unit.Placa_unidad || unit.Vin_unidad || '#' + id)}">Quitar unidad del ticket</button>
        </div>
        <div class="col-md-6 p-4 d-flex flex-column">
          <div class="mb-3">
            <h6 class="text-primary small fw-bold text-uppercase mb-2"><i class="bi bi-cpu me-1"></i> Equipo GPS</h6>
            <div id="sin-equipo-${id}" ${assigned ? 'hidden' : ''}>
              <button type="button" class="empty-slot p-3 rounded-4 w-100 border-0 btn-seleccionar-equipo" data-unit-id="${id}" data-bs-toggle="modal" data-bs-target="#modalSeleccionEquipo">
                <i class="bi bi-plus-circle-dotted fs-2 text-muted"></i><span class="d-block small text-muted mt-1">Asignar GPS</span>
              </button>
            </div>
            <div id="equipo-asignado-${id}" ${assigned ? '' : 'hidden'}>
              <div class="bg-primary bg-opacity-10 p-2 rounded-3 mb-2 border border-primary border-opacity-25" id="equipo-info-${id}">
                ${unit.Equipo ? renderEquipmentInfo(unit.Equipo.Equipo_stock?.Modelo_equipo ?? 'GPS Genérico', unit.Equipo.IMEI) : ''}
              </div>
              ${
                assigned
                  ? embedded && unit.Equipo ? `<button type="button" class="btn btn-outline-danger" data-ticket-action="release-equipment" data-unit-id="${id}" data-equipment-id="${unit.Equipo.ID_equipo}" data-ticket-id="${selectedTicket}">Liberar equipo</button>` : `<div class="alert alert-light border p-2 small text-secondary" data-bs-toggle="tooltip" title="Para modificar el equipo y sus accesorios, vaya a Detalles del Ticket."><i class="bi bi-lock-fill me-2"></i>Asignado (Solo Lectura)</div>`
                  : `
                <div class="d-flex gap-2 mt-2">
                  <button type="button" class="btn btn-outline-primary w-100 rounded-pill btn_cambiar_equipo" data-unit-id="${id}" data-bs-toggle="modal" data-bs-target="#modalSeleccionEquipo">Cambiar</button>
                  <button type="button" class="btn btn-outline-danger rounded-pill" aria-label="Quitar equipo seleccionado" data-action="release-local-equipment" data-unit-id="${id}"><i class="bi bi-x-lg"></i></button>
                </div>`
              }
            </div>
          </div>
          <div class="border-top pt-3 mt-auto">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <span class="small fw-bold text-muted text-uppercase">Accesorios</span>
              ${assigned && !embedded ? '' : `<button type="button" class="btn btn-outline-secondary rounded-pill btn-abrir-accesorios" aria-label="Agregar accesorio" data-unit-id="${id}" data-bs-toggle="modal" data-bs-target="#modalSeleccionAccesorio"><span aria-hidden="true">+</span> Agregar</button>`}
            </div>
            <div id="lista-accesorios-${id}" class="d-flex flex-wrap gap-2"></div>
          </div>
        </div>
      </div>
    </div>`;
  return column;
}

function updateEquipmentCard(unitId: string) {
  const assigned = state.equipment.has(unitId);
  element(`sin-equipo-${unitId}`).hidden = assigned;
  element(`equipo-asignado-${unitId}`).hidden = !assigned;
  const card = element(`unidad-row-${unitId}`);
  card.classList.toggle('assigned', assigned);
  card.classList.toggle('pending', !assigned);
  updateProgress();
}

function renderAccessories(unitId: string) {
  const list = element(`lista-accesorios-${unitId}`);
  list.replaceChildren();
  for (const accessory of state.accessories.get(unitId) ?? []) {
    const badge = document.createElement('span');
    badge.className =
      'badge bg-light text-dark border rounded-pill d-flex align-items-center gap-2';
    badge.textContent = accessory.name;
    if (accessory.readOnly && !embedded) {
      const lock = document.createElement('i');
      lock.className = 'bi bi-lock-fill';
      badge.append(lock);
    } else {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'btn-close';
      if (accessory.readOnly) {
        remove.dataset.ticketAction = 'remove-accessory';
        remove.dataset.ticketId = selectedTicket;
      } else remove.dataset.action = 'remove-local-accessory';
      remove.dataset.unitId = unitId;
      remove.dataset.accessoryId = accessory.id;
      remove.setAttribute('aria-label', `Quitar ${accessory.name}`);
      badge.append(remove);
    }
    list.append(badge);
  }
  updateProgress();
}

function updateEquipmentChoices() {
  const currentUnit = element('modalSeleccionEquipo').dataset.unitId;
  for (const button of document.querySelectorAll<HTMLButtonElement>('.btn_seleccion_equipo')) {
    const occupied = Array.from(state.equipment).some(([unitId, equipmentId]) => unitId !== currentUnit && equipmentId === button.dataset.id_equipo);
    button.disabled = occupied;
    button.textContent = occupied ? 'En otra unidad' : 'Seleccionar';
  }
}
element('modalSeleccionEquipo').addEventListener('show.bs.modal', updateEquipmentChoices);
element<HTMLInputElement>('assignment-equipment-search').addEventListener('input', event => {
  const term = (event.target as HTMLInputElement).value.trim().toLocaleLowerCase('es');
  for (const row of document.querySelectorAll<HTMLTableRowElement>('#tablaEquipos tbody tr')) {
    row.hidden = !row.textContent?.toLocaleLowerCase('es').includes(term);
  }
});

// Delegation survives card replacement without rebinding individual controls.
delegate(
  container,
  'click',
  '.btn-seleccionar-equipo, .btn_cambiar_equipo, .btn-abrir-accesorios',
  (button) => {
    if (actionBusy()) return;
    const modalId = button.classList.contains('btn-abrir-accesorios')
      ? 'modalSeleccionAccesorio'
      : 'modalSeleccionEquipo';
    element(modalId).dataset.unitId = button.dataset.unitId ?? '';
    if (modalId === 'modalSeleccionEquipo') updateEquipmentChoices();
  },
);
delegate(
  container,
  'click',
  '[data-action="release-local-equipment"], [data-action="remove-local-accessory"]',
  (button) => {
    if (actionBusy()) return;
    try {
      const id = button.dataset.unitId ?? '';
      if (button.dataset.action === 'release-local-equipment') {
        state.release(id);
        updateEquipmentCard(id);
      } else {
        state.removeAccessory(id, button.dataset.accessoryId ?? '');
        renderAccessories(id);
      }
    } catch (error) {
      void showError(error);
    }
  },
);
delegate(document, 'click', '.btn_seleccion_equipo', (button) => {
  if (actionBusy()) return;
  try {
    const id = element('modalSeleccionEquipo').dataset.unitId;
    if (!id) return;
    state.assign(id, button.dataset.id_equipo ?? '');
    element(`equipo-info-${id}`).innerHTML = renderEquipmentInfo(
      button.dataset.modelo ?? '',
      button.dataset.imei ?? '',
    );
    updateEquipmentCard(id);
  } catch (error) {
    void showError(error);
  }
});
delegate(document, 'click', '.btn_agregar_accesorio_modal', (button) => {
  if (actionBusy()) return;
  try {
    const id = element('modalSeleccionAccesorio').dataset.unitId;
    if (!id || (state.lockedUnits.has(id) && !embedded)) return;
    state.addAccessory(id, {
      id: button.dataset.id ?? '',
      name: button.dataset.nombre ?? '',
      readOnly: false,
    });
    renderAccessories(id);
    hideModal('modalSeleccionAccesorio');
  } catch (error) {
    void showError(error);
  }
});
saveButton.addEventListener('click', () => {
  if (!actionBusy()) void saveAssignments().catch(showError);
});
async function saveAssignments() {
  const count = state.equipment.size;
  if (!equipmentAssignmentDirty()) {
    await showDialog({
      title: 'Sin cambios',
      text: 'Selecciona un equipo o accesorio antes de guardar.',
      icon: 'info',
    });
    return;
  }
  // Lock the selection for both confirmation and persistence, preventing duplicate submissions.
  saving = true;
  saveButton.disabled = true;
  try {
    const partial = count < unitCount;
    const confirmed = await showDialog({
      title: partial ? 'Asignación Incompleta' : '¿Confirmar asignaciones?',
      text: partial && count > 0
        ? `Estás asignando equipos a ${count} de ${unitCount} unidades. El ticket quedará en estado "Parcial".`
        : `Se guardarán los cambios para el ticket #${selectedTicket}.${count === 0 ? ' Aún quedan equipos por asignar.' : ''}`,
      icon: partial ? 'warning' : 'question',
      showCancelButton: true,
      confirmButtonText: partial ? 'Guardar Avance (Parcial)' : 'Sí, guardar asignaciones',
      cancelButtonText: 'Cancelar',
    });
    if (!confirmed) return;
    const result = await postJson<{ message?: string }>('/asignar_equipos', {
      datosAsignacion: state.toRequest(),
      idTicket: selectedTicket,
    });
    await showDialog({
      title: '¡Guardado!',
      text: result.message ?? 'Cambios aplicados correctamente.',
      icon: 'success',
    });
    document.dispatchEvent(new Event('assignment:saved'));
    // The coordinator already keeps this ticket in the URL; refresh its saved stage.
    location.reload();
  } finally {
    saving = false;
    updateProgress();
  }
}

delegate(container, 'click', '[data-action="remove-saved-unit"]', button => {
  if (actionBusy()) return;
  saving = true;
  saveButton.disabled = true;
  void confirmUnitRemoval(selectedTicket, button.dataset.unitId ?? '', button.dataset.unitLabel ?? 'seleccionada', equipmentAssignmentDirty())
    .catch(showError).finally(() => { saving = false; updateProgress(); });
});
