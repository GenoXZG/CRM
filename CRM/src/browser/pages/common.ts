import { delegate, setField } from '../shared/dom.js';

delegate(document, 'click', '.toggler-btn', () => {
  document.getElementById('sidebar')?.classList.toggle('collapsed');
});

// Templates declare field mappings; one handler replaces separate catalog scripts.
for (const modal of document.querySelectorAll<HTMLElement>('[data-field-map]')) {
  const mapping = JSON.parse(modal.dataset.fieldMap ?? '{}') as Record<string, string>;
  modal.addEventListener('show.bs.modal', (event) => {
    const trigger: unknown = (event as Event & { relatedTarget?: unknown }).relatedTarget;
    if (!(trigger instanceof HTMLElement)) return;
    for (const [fieldId, datasetKey] of Object.entries(mapping)) {
      setField(fieldId, trigger.dataset[datasetKey] ?? '');
    }
  });
}
