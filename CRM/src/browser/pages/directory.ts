import './common.js';
import { requestJson } from '../shared/http.js';

let saving = false;
let leaving = false;
const snapshots = new Map<HTMLFormElement, string>();
function values(form: HTMLFormElement) {
  return JSON.stringify(Array.from(form.querySelectorAll<HTMLInputElement | HTMLSelectElement>('fieldset input, fieldset select')).map(input => input.value));
}
function dirty(form: HTMLFormElement) { return snapshots.get(form) !== values(form); }
for (const select of document.querySelectorAll<HTMLSelectElement>('select[name$="_size"]'))
  select.addEventListener('change', () => select.form?.requestSubmit());

for (const form of document.querySelectorAll<HTMLFormElement>('[data-directory-form]')) {
  const modal = form.closest<HTMLElement>('.modal')!;
  const error = form.querySelector<HTMLElement>('[data-directory-error]')!;
  const submit = form.querySelector<HTMLButtonElement>('[type="submit"]')!;
  const fields = form.querySelector<HTMLFieldSetElement>('fieldset');
  snapshots.set(form, values(form));
  modal.addEventListener('show.bs.modal', () => {
    snapshots.set(form, values(form));
    error.classList.add('d-none');
    for (const input of form.querySelectorAll<HTMLInputElement>('input[type="tel"]')) input.setCustomValidity('');
  });
  modal.addEventListener('shown.bs.modal', () => {
    form.querySelector<HTMLElement>('fieldset input, fieldset select')?.focus();
  });
  modal.addEventListener('hide.bs.modal', event => {
    if (saving || (dirty(form) && !window.confirm('Hay cambios sin guardar. ¿Deseas descartarlos?'))) {
      event.preventDefault();
      return;
    }
    form.reset();
    snapshots.set(form, values(form));
  });
  for (const input of form.querySelectorAll<HTMLInputElement>('input[type="tel"]')) {
    input.addEventListener('input', () => input.setCustomValidity(''));
    input.addEventListener('change', () => {
      input.setCustomValidity(/^\d{10}$/.test(input.value.trim().replace(/[\s().-]/g, '')) ? '' : 'El teléfono debe contener 10 dígitos.');
    });
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (saving || !form.reportValidity()) return;
    const data = Object.fromEntries(new FormData(form).entries());
    const label = submit.textContent;
    saving = true;
    if (fields) fields.disabled = true;
    submit.disabled = true;
    submit.textContent = 'Guardando…';
    error.classList.add('d-none');
    void requestJson<{ success: boolean; redirect: string }>(form.action, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(data),
    }).then(result => {
      const url = new URL(result.redirect, location.origin);
      if (url.origin !== location.origin) throw new Error('Destino de regreso inválido.');
      if (url.pathname === '/directorio') url.searchParams.set('notice', form.dataset.directoryAction ?? '');
      leaving = true;
      location.assign(url.pathname + url.search + url.hash);
    }).catch((failure: unknown) => {
      error.textContent = failure instanceof Error ? failure.message : 'No se pudo guardar el cambio.';
      error.classList.remove('d-none');
    }).finally(() => {
      saving = false;
      if (fields) fields.disabled = false;
      submit.disabled = false;
      submit.textContent = label;
    });
  });
}
window.addEventListener('beforeunload', event => {
  const open = document.querySelector<HTMLFormElement>('.modal.show [data-directory-form]');
  if (!leaving && (saving || (open && dirty(open)))) { event.preventDefault(); event.returnValue = ''; }
});
if (!location.hash) {
  const focus = document.body.dataset.directoryFocus;
  if (focus) document.getElementById(focus)?.scrollIntoView();
}
