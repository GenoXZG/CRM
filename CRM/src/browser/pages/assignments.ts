import { delegate, element } from '../shared/dom.js';
import { showDialog, showError } from '../shared/dialogs.js';
import { assignmentBusy, assignmentDirty, resetAssignment, openAssignment, protectAssignmentChanges } from '../shared/assignment-workspace.js';

const workspace = element('assignment-workspace');
const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.assignment-ticket'));
const rows = Array.from(document.querySelectorAll<HTMLTableRowElement>('[data-assignment-row]'));
const search = element<HTMLInputElement>('assignment-search');
const stage = element<HTMLSelectElement>('assignment-stage');
const size = element<HTMLSelectElement>('assignment-size');
const previous = element<HTMLButtonElement>('assignment-prev');
const next = element<HTMLButtonElement>('assignment-next');
let currentPage = 1;
let selected: HTMLButtonElement | undefined;
let selecting = false;

function updateQueue() {
  const term = search.value.trim().toLocaleLowerCase('es');
  const matches = rows.filter(row => (!stage.value || row.dataset.stage === stage.value) && row.textContent?.toLocaleLowerCase('es').includes(term));
  const limit = Number(size.value);
  const pages = Math.max(1, Math.ceil(matches.length / limit));
  currentPage = Math.min(currentPage, pages);
  const visible = new Set(matches.slice((currentPage - 1) * limit, currentPage * limit));
  for (const row of rows) row.hidden = !visible.has(row);
  element('assignment-empty').hidden = matches.length > 0;
  element('assignment-results').textContent = `${matches.length ? (currentPage - 1) * limit + 1 : 0}–${Math.min(currentPage * limit, matches.length)} de ${matches.length} tickets`;
  element('assignment-page').textContent = `Página ${currentPage} de ${pages}`;
  previous.disabled = currentPage <= 1;
  next.disabled = currentPage >= pages;
}
for (const field of [search, stage, size]) field.addEventListener(field === search ? 'input' : 'change', () => { currentPage = 1; updateQueue(); });
previous.addEventListener('click', () => { currentPage--; updateQueue(); });
next.addEventListener('click', () => { currentPage++; updateQueue(); });

function busy() { return selecting || assignmentBusy(); }
function dirty() { return assignmentDirty(); }
async function confirmDiscard() {
  return !dirty() || showDialog({ title: 'Cambios sin guardar', text: 'Si cambias de ticket perderás los cambios que aún no has guardado.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Descartar y continuar', cancelButtonText: 'Seguir trabajando' });
}
function clearSelection() {
  resetAssignment();
  workspace.classList.add('d-none');
  for (const button of buttons) {
    button.setAttribute('aria-pressed', 'false');
    button.textContent = 'Seleccionar';
    button.closest('tr')?.classList.remove('selected');
  }
  selected = undefined;
}
async function selectTicket(button: HTMLButtonElement) {
  if (busy() || button === selected) return;
  selecting = true;
  try {
    if (!(await confirmDiscard())) return;
    clearSelection();
    selected = button;
    button.setAttribute('aria-pressed', 'true');
    button.textContent = 'Seleccionado';
    button.closest('tr')?.classList.add('selected');
    element('assignment-notice').classList.add('d-none');
    const id = button.dataset.id_ticket ?? '';
    const url = new URL(location.href); url.pathname = '/asignaciones'; url.searchParams.set('ticket', id); url.hash = 'assignment-workspace';
    history.replaceState(null, '', url);
    element('assignment-ticket-id').textContent = id;
    element('assignment-client').textContent = button.dataset.cliente ?? '';
    element('assignment-technician').textContent = button.dataset.tecnico ?? '';
    element('assignment-unit-count').textContent = button.dataset.num_unidades ?? '';
    element<HTMLAnchorElement>('assignment-details').href = `/detalle_ticket/${encodeURIComponent(id)}`;
    workspace.classList.remove('d-none');
    workspace.setAttribute('aria-busy', 'true');
    await openAssignment(button);
    workspace.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    clearSelection();
    await showError(error);
  } finally {
    selecting = false;
    workspace.setAttribute('aria-busy', 'false');
  }
}
delegate(document, 'click', '.assignment-ticket', button => { void selectTicket(button as HTMLButtonElement); });
delegate(document, 'click', '[data-action="close-assignment"]', () => {
  if (busy()) return;
  selecting = true;
  void confirmDiscard().then(confirmed => {
    if (!confirmed) return;
    clearSelection();
    const url = new URL(location.href); url.searchParams.delete('ticket'); url.hash = '';
    history.replaceState(null, '', url);
    element('assignment-queue-title').scrollIntoView({ behavior: 'smooth' });
  }).catch(showError).finally(() => { selecting = false; });
});
protectAssignmentChanges();
updateQueue();
const requested = new URL(location.href).searchParams.get('ticket');
if (requested) {
  const button = buttons.find(candidate => candidate.dataset.id_ticket === requested);
  if (button) { currentPage = Math.floor(buttons.indexOf(button) / Number(size.value)) + 1; updateQueue(); void selectTicket(button); }
  else { const notice = element('assignment-notice'); notice.textContent = 'El ticket solicitado no está disponible para asignación. Puede haberse finalizado o eliminado. Selecciona otro ticket abierto.'; notice.classList.remove('d-none'); }
}
