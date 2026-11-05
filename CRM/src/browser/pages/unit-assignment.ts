import './common.js';
import { delegate, element } from '../shared/dom.js';
import { showDialog, showError } from '../shared/dialogs.js';
import { createRequestCache, postJson } from '../shared/http.js';

interface BrandResponse {
  Marca_unidad: string;
}
interface ModelResponse {
  ID_Unidad_modelo: number;
  Modelo_Unidad: string;
}
const loadBrands = createRequestCache<BrandResponse[]>();
const loadModels = createRequestCache<ModelResponse[]>();
const panel = element('card-asignacion');
const rows = element('cuerpo_tabla_unidades');
const form = element<HTMLFormElement>('form_unidades');
const saveButton = element<HTMLButtonElement>('btn_registrar_unidad');
let selectedTicket = '';
let selectionVersion = 0;
let saving = false;
const embedded = document.body.dataset.ticketWorkspace === 'true';
function actionBusy() { return saving || document.body.dataset.ticketActionBusy === 'true'; }
let originalCount = 0;

function addOptions(select: HTMLSelectElement, values: [string, string][], placeholder: string) {
  select.replaceChildren(new Option(placeholder, '', true, true));
  select.options[0]!.disabled = true;
  for (const [label, value] of values) select.add(new Option(label, value));
}

export const unitAssignmentBusy = () => saving;
export const unitAssignmentDirty = () => (Boolean(selectedTicket) && rows.querySelectorAll('tr').length < originalCount) || Array.from(form.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select')).some(field => Boolean(field.value));
export function resetUnitAssignment() {
  selectionVersion++;
  selectedTicket = '';
  originalCount = 0;
  panel.classList.add('d-none');
  rows.replaceChildren();
  saveButton.disabled = true;
}

export async function selectUnitTicket(button: HTMLElement) {
  const version = ++selectionVersion;
  selectedTicket = button.dataset.id_ticket ?? '';
  const count = Number(button.dataset.num_unidades);
  originalCount = count;
  saveButton.disabled = true;
  panel.classList.remove('d-none');
  element('lbl-cliente-seleccionado').textContent = button.dataset.cliente ?? '';
  element('lbl-ticket-seleccionado').textContent = selectedTicket;
  rows.replaceChildren();
  if (!embedded) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const brands = await loadBrands('/test');
  if (version !== selectionVersion) return;
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < count; index++) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="p-3" data-label="Marca"><select class="form-select select_marca bg-light border-0" name="marca" aria-label="Marca de la unidad ${index + 1}" required></select></td>
      <td class="p-3" data-label="Modelo"><select class="form-select select_modelo bg-light border-0" name="modelo" aria-label="Modelo de la unidad ${index + 1}" required></select></td>
      <td class="p-3" data-label="Placa"><input class="form-control bg-light border-0" name="placa_unidad" maxlength="255" aria-label="Placa de la unidad ${index + 1}" placeholder="EJ: ABC-123" required></td>
      <td class="p-3" data-label="VIN / Serie"><input class="form-control bg-light border-0" name="vin_unidad" maxlength="255" aria-label="VIN de la unidad ${index + 1}" placeholder="17 dígitos..." required></td>
      <td class="p-3 text-end" data-label="Acciones"><button type="button" class="btn btn-outline-danger" data-action="remove-draft-unit" aria-label="Quitar unidad ${index + 1}">Quitar unidad</button></td>`;
    addOptions(
      row.querySelector<HTMLSelectElement>('.select_marca')!,
      brands.map((brand) => [brand.Marca_unidad, brand.Marca_unidad]),
      '-- Seleccionar Marca --',
    );
    addOptions(
      row.querySelector<HTMLSelectElement>('.select_modelo')!,
      [],
      'Primero seleccione marca',
    );
    fragment.append(row);
  }
  rows.replaceChildren(fragment);
  updateDraftCount();
  saveButton.disabled = false;
}

function updateDraftCount() {
  const count = rows.querySelectorAll('tr').length;
  for (const button of rows.querySelectorAll<HTMLButtonElement>('[data-action="remove-draft-unit"]')) {
    button.disabled = count <= 1;
    button.title = count <= 1 ? 'El ticket debe conservar al menos una unidad' : 'Quitar esta unidad del registro';
  }
  element('unit-registration-count').textContent = count < originalCount
    ? `Se registrarán ${count} de ${originalCount} unidades previstas. Al guardar, el ticket se ajustará a ${count} unidades.`
    : `Se registrarán ${count} unidades.`;
}
delegate(rows, 'click', '[data-action="remove-draft-unit"]', button => {
  if (actionBusy()) return;
  const row = button.closest('tr');
  if (!row) return;
  if (rows.querySelectorAll('tr').length <= 1) {
    void showDialog({ title: 'Última unidad', text: 'Conserva al menos una unidad para continuar con el registro.', icon: 'info' });
    return;
  }
  saving = true;
  saveButton.disabled = true;
  void showDialog({ title: '¿Quitar esta unidad del registro?', text: 'Se quitará esta fila. La cantidad prevista del ticket se reducirá cuando guardes las unidades restantes.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Quitar unidad', cancelButtonText: 'Conservar unidad' })
    .then(confirmed => { if (confirmed) { row.remove(); updateDraftCount(); } })
    .catch(showError).finally(() => { saving = false; saveButton.disabled = false; });
});

delegate(rows, 'change', '.select_marca', (target) => {
  void updateModels(target as HTMLSelectElement).catch(showError);
});
async function updateModels(brandSelect: HTMLSelectElement) {
  const modelSelect = brandSelect
    .closest('tr')!
    .querySelector<HTMLSelectElement>('.select_modelo')!;
  const brand = brandSelect.value;
  const version = selectionVersion;
  modelSelect.disabled = true;
  addOptions(modelSelect, [], 'Cargando...');
  try {
    const models = await loadModels(`/modelos?marca=${encodeURIComponent(brand)}`);
    if (version !== selectionVersion || brandSelect.value !== brand || !modelSelect.isConnected)
      return;
    addOptions(
      modelSelect,
      models.map((model) => [model.Modelo_Unidad, String(model.ID_Unidad_modelo)]),
      models.length ? '-- Seleccionar Modelo --' : 'Sin modelos registrados',
    );
  } catch (error) {
    if (brandSelect.value !== brand || version !== selectionVersion) return;
    addOptions(modelSelect, [], 'Error al cargar; seleccione la marca de nuevo');
    throw error;
  } finally {
    if (brandSelect.value === brand && version === selectionVersion) modelSelect.disabled = false;
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!actionBusy()) void saveUnits().catch(showError);
});
async function saveUnits() {
  if (!selectedTicket || actionBusy() || !form.reportValidity()) return;
  const units = Array.from(rows.querySelectorAll('tr'), (row) => ({
    modelo: row.querySelector<HTMLSelectElement>('[name="modelo"]')!.value,
    placa: row.querySelector<HTMLInputElement>('[name="placa_unidad"]')!.value,
    vin: row.querySelector<HTMLInputElement>('[name="vin_unidad"]')!.value,
    ticketId: selectedTicket,
  }));
  // Disabled/loading model selects are excluded from native validation.
  if (!units.length || units.some((unit) => !unit.modelo)) {
    throw new Error('Seleccione un modelo para cada unidad antes de guardar.');
  }
  saving = true;
  saveButton.disabled = true;
  try {
    const reducing = units.length < originalCount;
    if (reducing && !(await showDialog({ title: 'Confirmar cantidad de unidades', text: `El ticket pasará de ${originalCount} a ${units.length} unidades. ¿Guardar esta cantidad y continuar?`, icon: 'warning', showCancelButton: true, confirmButtonText: 'Guardar y ajustar cantidad', cancelButtonText: 'Revisar unidades' }))) return;
    await postJson('/add_unidades', { unidades: units, reducirCantidad: reducing, cantidadPrevistaOriginal: originalCount });
    await showDialog({
      title: '¡Asignación Exitosa!',
      text: 'Las unidades se guardaron. Continúa con los equipos y accesorios del mismo ticket.',
      icon: 'success',
    });
    document.dispatchEvent(new Event('assignment:saved'));
    // The coordinator already keeps this ticket in the URL; refresh its saved stage.
    location.reload();
  } finally {
    saving = false;
    saveButton.disabled = false;
  }
}
