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

function addOptions(select: HTMLSelectElement, values: [string, string][], placeholder: string) {
  select.replaceChildren(new Option(placeholder, '', true, true));
  select.options[0]!.disabled = true;
  for (const [label, value] of values) select.add(new Option(label, value));
}

delegate(document, 'click', '[data-action="cancel-unit-assignment"]', () => {
  if (saving) return;
  selectionVersion++;
  selectedTicket = '';
  panel.classList.add('d-none');
  rows.replaceChildren();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

delegate(document, 'click', '.btn_seleccion_ticket', (button) => {
  if (saving) return;
  void selectTicket(button).catch(showError);
});

async function selectTicket(button: HTMLElement) {
  const version = ++selectionVersion;
  selectedTicket = button.dataset.id_ticket ?? '';
  const count = Number(button.dataset.num_unidades);
  saveButton.disabled = true;
  panel.classList.remove('d-none');
  element('lbl-cliente-seleccionado').textContent = button.dataset.cliente ?? '';
  element('lbl-ticket-seleccionado').textContent = selectedTicket;
  rows.replaceChildren();
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const brands = await loadBrands('/test');
  if (version !== selectionVersion) return;
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < count; index++) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="p-3"><select class="form-select select_marca bg-light border-0" name="marca" required></select></td>
      <td class="p-3"><select class="form-select select_modelo bg-light border-0" name="modelo" required></select></td>
      <td class="p-3"><input class="form-control bg-light border-0" name="placa_unidad" placeholder="EJ: ABC-123" required></td>
      <td class="p-3"><input class="form-control bg-light border-0" name="vin_unidad" placeholder="17 dígitos..." required></td>`;
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
  saveButton.disabled = false;
}

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
  if (!saving) void saveUnits().catch(showError);
});
async function saveUnits() {
  if (!selectedTicket || !form.reportValidity()) return;
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
    await postJson('/add_unidades', { unidades: units });
    await showDialog({
      title: '¡Asignación Exitosa!',
      text: 'Las unidades han sido registradas correctamente.',
      icon: 'success',
    });
    location.reload();
  } finally {
    saving = false;
    saveButton.disabled = false;
  }
}
