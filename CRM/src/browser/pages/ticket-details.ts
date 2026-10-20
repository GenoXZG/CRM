import './common.js';
import { delegate, element } from '../shared/dom.js';
import { showDialog, showError } from '../shared/dialogs.js';
import { postJson } from '../shared/http.js';
import { confirmUnitRemoval } from '../shared/unit-removal.js';

let pendingAction = false;
let assignment: typeof import('../shared/assignment-workspace.js') | undefined;
let protectedAssignment = false;
const assignmentFields = document.getElementById('ticket-assignment-fields');
const assignmentContext = document.getElementById('ticket-assignment-context');
async function initializeAssignment() {
  if (!(assignmentContext instanceof HTMLElement) || !(assignmentFields instanceof HTMLFieldSetElement)) return;
  assignmentFields.disabled = true;
  const errorPanel = element('ticket-assignment-error');
  errorPanel.classList.add('d-none');
  try {
    assignment = await import('../shared/assignment-workspace.js');
    if (!protectedAssignment) { assignment.protectAssignmentChanges(); protectedAssignment = true; }
    await assignment.openAssignment(assignmentContext);
    delete assignmentFields.dataset.failed;
    assignmentFields.disabled = false;
  } catch (error) {
    assignmentFields.dataset.failed = 'true';
    errorPanel.querySelector('span')!.textContent = error instanceof Error ? error.message : 'No se pudo cargar la asignación.';
    errorPanel.classList.remove('d-none');
  }
}
if (assignmentContext) void initializeAssignment();
document.getElementById('ticket-assignment-retry')?.addEventListener('click', () => { void initializeAssignment(); });
function setActionBusy(value: boolean) {
  pendingAction = value;
  document.body.dataset.ticketActionBusy = String(value);
  if (assignmentFields instanceof HTMLFieldSetElement) assignmentFields.disabled = value || assignmentFields.dataset.failed === 'true';
}

delegate(document, 'click', '[data-ticket-action]', (button) => {
  if (!pendingAction && !assignment?.assignmentBusy()) void performAction(button).catch(showError);
});

async function performAction(button: HTMLElement) {
  const action = button.dataset.ticketAction;
  setActionBusy(true);
  try {
    if (action === 'copy-location') {
      const input = element<HTMLInputElement>('inputLinkMaps');
      if (!input.value) {
        await showDialog({
          title: 'Vacío',
          text: 'No hay un enlace registrado para copiar.',
          icon: 'info',
        });
        return;
      }
      try {
        await navigator.clipboard.writeText(input.value);
      } catch {
        input.select();
        if (!document.execCommand('copy'))
          throw new Error(
            'No se pudo copiar el enlace. Puede copiarlo desde el campo de ubicación.',
          );
      }
      await showDialog({ title: '¡Enlace copiado al portapapeles!', icon: 'success' });
      return;
    }
    if (action === 'print') {
      window.print();
      return;
    }
    if (action === 'select-photos') {
      element<HTMLInputElement>('inputFotosReal').click();
      return;
    }
    if (action === 'complete' || action === 'reopen') {
      if (assignment?.assignmentDirty()) {
        await showDialog({ title: 'Hay asignaciones sin guardar', text: 'Guarda o descarta los cambios de unidades, equipos y accesorios antes de cambiar el estado del servicio.', icon: 'warning' });
        return;
      }
      const noPhotos = action === 'complete' && Number(button.dataset.photoCount) === 0;
      const confirmed = await showDialog({
        title:
          action === 'reopen'
            ? '¿Reabrir Servicio?'
            : noPhotos
              ? '¡Sin Evidencia Fotográfica!'
              : '¿Finalizar Servicio?',
        text:
          action === 'reopen'
            ? "El estatus regresará a 'En seguimiento' y podrás editar la información nuevamente."
            : noPhotos
              ? 'No has subido fotos. ¿Deseas finalizar el servicio sin evidencia?'
              : "El estatus cambiará a 'Finalizado'.",
        icon: noPhotos || action === 'reopen' ? 'warning' : 'question',
        showCancelButton: true,
        confirmButtonText:
          action === 'reopen'
            ? 'Sí, reabrir servicio'
            : noPhotos
              ? 'Sí, finalizar sin fotos'
              : 'Sí, finalizar',
        cancelButtonText: 'Cancelar',
      });
      if (!confirmed) return;
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = `/tickets/${action === 'complete' ? 'finalizar' : 'reabrir'}/${button.dataset.ticketId}`;
      document.body.append(form);
      form.submit();
      return;
    }
    if (action === 'remove-unit') {
      await confirmUnitRemoval(button.dataset.ticketId ?? '', button.dataset.unitId ?? '', button.dataset.unitLabel ?? 'seleccionada');
      return;
    }
    if (action === 'release-equipment' || action === 'remove-accessory') {
      const equipment = action === 'release-equipment';
      const confirmed = await showDialog({
        title: equipment ? '¿Liberar equipo GPS?' : '¿Quitar accesorio?',
        text: (equipment
          ? "El equipo volverá a 'Pendiente de asignación' y la unidad quedará sin GPS."
          : 'Se eliminará de la lista de esta unidad.') + (assignment?.assignmentDirty() ? ' Se descartarán las asignaciones que aún no has guardado.' : ''),
        icon: equipment ? 'warning' : 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, quitar',
        cancelButtonText: 'Cancelar',
      });
      if (!confirmed) return;
      await postJson(
        equipment ? '/desvincular_equipo' : '/desvincular_accesorio',
        equipment
          ? {
              idUnidad: button.dataset.unitId,
              idEquipo: button.dataset.equipmentId,
              idTicket: button.dataset.ticketId,
            }
          : { idUnidad: button.dataset.unitId, idAccesorio: button.dataset.accessoryId },
      );
      document.dispatchEvent(new Event('assignment:saved'));
      location.reload();
    }
  } finally {
    setActionBusy(false);
  }
}

const approvedForms = new WeakSet<HTMLFormElement>();
document.addEventListener('submit', event => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || form.id === 'form_unidades') return;
  if (approvedForms.delete(form)) return;
  if (pendingAction || assignment?.assignmentBusy()) { event.preventDefault(); event.stopImmediatePropagation(); return; }
  if (!assignment?.assignmentDirty()) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const submitter = (event as SubmitEvent).submitter;
  setActionBusy(true);
  void showDialog({ title: 'Asignaciones sin guardar', text: 'Al guardar este cambio se recargará el ticket y se descartarán las asignaciones pendientes. ¿Continuar?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Descartar asignaciones y continuar', cancelButtonText: 'Seguir trabajando' })
    .then(confirmed => {
      setActionBusy(false);
      if (!confirmed) return;
      approvedForms.add(form);
      document.dispatchEvent(new Event('assignment:saved'));
      form.requestSubmit(submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement ? submitter : undefined);
    }).catch(showError).finally(() => { setActionBusy(false); });
}, true);

const printDate = document.getElementById('print-date');
if (printDate) printDate.textContent = new Date().toLocaleDateString('es-MX');

const input = document.getElementById('inputFotosReal');
if (input instanceof HTMLInputElement) setupPhotoSelection(input);

function setupPhotoSelection(input: HTMLInputElement) {
  const preview = element('previewContainer');
  const upload = element<HTMLButtonElement>('btnSubirReal');
  let files: File[] = [];
  let urls: string[] = [];
  const viewer = document.createElement('dialog');
  viewer.className = 'border-0 rounded-4 p-3';
  const image = document.createElement('img');
  image.style.maxWidth = '80vw';
  image.style.maxHeight = '80vh';
  image.alt = 'Vista previa de evidencia';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'btn-close d-block ms-auto mb-2';
  close.setAttribute('aria-label', 'Cerrar vista previa');
  close.addEventListener('click', () => viewer.close());
  viewer.append(close, image);
  document.body.append(viewer);

  function releaseUrls() {
    for (const url of urls) URL.revokeObjectURL(url);
    urls = [];
  }
  function render() {
    releaseUrls();
    preview.replaceChildren();
    const transfer = new DataTransfer();
    for (const file of files) transfer.items.add(file);
    input.files = transfer.files;
    upload.classList.toggle('d-none', files.length === 0);
    element('conteoArchivos').textContent = files.length
      ? `${files.length} archivos listos para subir`
      : '0 archivos seleccionados';
    files.forEach((file, index) => {
      const url = URL.createObjectURL(file);
      urls.push(url);
      const wrapper = document.createElement('div');
      wrapper.className = 'position-relative d-inline-block';
      const thumbnail = document.createElement('img');
      thumbnail.src = url;
      thumbnail.alt = file.name;
      thumbnail.className = 'rounded-3 shadow-sm object-fit-cover border';
      thumbnail.style.width = '80px';
      thumbnail.style.height = '80px';
      thumbnail.tabIndex = 0;
      const show = () => {
        image.src = url;
        viewer.showModal();
      };
      thumbnail.addEventListener('click', show);
      thumbnail.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') show();
      });
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'position-absolute top-0 end-0 badge rounded-pill bg-danger border';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `Quitar ${file.name}`);
      remove.addEventListener('click', () => {
        files.splice(index, 1);
        render();
      });
      wrapper.append(thumbnail, remove);
      preview.append(wrapper);
    });
  }
  input.addEventListener('change', () => {
    const images = Array.from(input.files ?? []).filter((file) => file.type.startsWith('image/'));
    const combined = [...files];
    for (const file of images) {
      if (
        !combined.some(
          (existing) =>
            existing.name === file.name &&
            existing.size === file.size &&
            existing.lastModified === file.lastModified,
        )
      )
        combined.push(file);
    }
    const exceeded = combined.length > 5;
    files = combined.slice(0, 5);
    render();
    if (exceeded)
      void showDialog({
        title: 'Límite de archivos',
        text: 'Puede subir hasta 5 fotos por envío.',
        icon: 'warning',
      });
  });
  element<HTMLFormElement>('formSubida').addEventListener('submit', () => {
    upload.disabled = true;
  });
  window.addEventListener('pagehide', releaseUrls);
}
