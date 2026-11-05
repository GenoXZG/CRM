import './common.js';
import { element } from '../shared/dom.js';

const form = element<HTMLFormElement>('ticket-filters');
element<HTMLSelectElement>('ticket-size').addEventListener('change', () => form.requestSubmit());
const from = element<HTMLInputElement>('ticket-date-from');
const to = element<HTMLInputElement>('ticket-date-to');
function updateDates() {
  to.min = from.value;
  from.max = to.value;
}
from.addEventListener('change', updateDates);
to.addEventListener('change', updateDates);
updateDates();

if (document.getElementById('new-ticket')) {
const list = element('ticket-list-workspace');
const panel = element('ticket-create-panel');
const trigger = element<HTMLAnchorElement>('new-ticket');
const back = element<HTMLButtonElement>('ticket-create-back');
const fields = element('ticket-create-fields');
let creator: typeof import('./ticket-form.js') | undefined;
let loading = false;
let pushed = false;
let listScroll = 0;
async function showCreator(push = false) {
  listScroll = list.hidden ? listScroll : window.scrollY;
  if (push && location.hash !== '#nuevo-ticket') {
    history.pushState(null, '', location.pathname + location.search + '#nuevo-ticket');
    pushed = true;
  }
  list.hidden = true;
  panel.hidden = false;
  trigger.setAttribute('aria-expanded', 'true');
  if (loading) return;
  loading = true;
  fields.inert = true;
  panel.setAttribute('aria-busy', 'true');
  element('ticket-create-load-error').classList.add('d-none');
  try {
    creator = await import('./ticket-form.js');
    fields.inert = false;
    if (!panel.hidden) element('ticket-create-panel-title').focus();
  } catch {
    element('ticket-create-load-error').classList.remove('d-none');
  } finally { loading = false; panel.removeAttribute('aria-busy'); }
}
function hideCreator() {
  if (creator?.ticketCreationBusy()) return;
  panel.hidden = true;
  list.hidden = false;
  trigger.setAttribute('aria-expanded', 'false');
  trigger.textContent = creator?.ticketCreationDirty() ? 'Continuar borrador' : '+ Nuevo ticket';
  trigger.focus({ preventScroll: true });
  window.scrollTo(0, listScroll);
}
trigger.addEventListener('click', event => {
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  void showCreator(true);
});
back.addEventListener('click', () => {
  if (creator?.ticketCreationBusy()) return;
  if (pushed && location.hash === '#nuevo-ticket') { pushed = false; history.back(); }
  else { history.replaceState(null, '', location.pathname + location.search); hideCreator(); }
});
window.addEventListener('popstate', () => {
  if (location.hash === '#nuevo-ticket') void showCreator();
  else hideCreator();
});
if (location.hash === '#nuevo-ticket') void showCreator();
document.addEventListener('ticket:created-return', () => {
  pushed = false;
  history.replaceState(null, '', location.pathname + location.search);
  hideCreator();
});

}
