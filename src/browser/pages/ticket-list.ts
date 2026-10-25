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
