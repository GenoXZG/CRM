import { element } from './dom.js';
import { selectUnitTicket, resetUnitAssignment, unitAssignmentBusy, unitAssignmentDirty } from '../pages/unit-assignment.js';
import { selectEquipmentTicket, resetEquipmentAssignment, equipmentAssignmentBusy, equipmentAssignmentDirty } from '../pages/equipment-assignment.js';

let loading = false;
export const assignmentBusy = () => loading || unitAssignmentBusy() || equipmentAssignmentBusy();
export const assignmentDirty = () => unitAssignmentDirty() || equipmentAssignmentDirty();
export function resetAssignment() {
  resetUnitAssignment();
  resetEquipmentAssignment();
}
function setStep(id: string, state: 'active' | 'complete' | '') {
  const step = document.getElementById(id);
  if (!step) return;
  step.classList.toggle('active', state === 'active');
  step.classList.toggle('complete', state === 'complete');
  if (state === 'active') step.setAttribute('aria-current', 'step');
  else step.removeAttribute('aria-current');
}
export async function openAssignment(ticket: HTMLElement) {
  loading = true;
  try {
    resetAssignment();
    const needsUnits = ticket.dataset.stage === 'units';
    element('equipment-locked').classList.toggle('d-none', !needsUnits);
    setStep('assignment-step-units', needsUnits ? 'active' : 'complete');
    setStep('assignment-step-equipment', needsUnits ? '' : 'active');
    setStep('assignment-step-ready', '');
    if (needsUnits) await selectUnitTicket(ticket);
    else {
      const summary = await selectEquipmentTicket(ticket);
      if (summary && summary.total > 0 && summary.total === Number(ticket.dataset.num_unidades) && summary.equipped === summary.total) {
        setStep('assignment-step-equipment', 'complete');
        setStep('assignment-step-ready', 'complete');
      }
    }
  } finally { loading = false; }
}
export function protectAssignmentChanges() {
  let navigationAllowed = false;
  document.addEventListener('assignment:saved', () => { navigationAllowed = true; });
  window.addEventListener('beforeunload', event => {
    if (!navigationAllowed && assignmentDirty()) { event.preventDefault(); event.returnValue = ''; }
  });
}
