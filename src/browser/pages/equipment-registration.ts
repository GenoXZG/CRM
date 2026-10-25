import './common.js';
import { delegate, element, setField } from '../shared/dom.js';

delegate(document, 'click', '.btn_confirmar_modelo', (button) => {
  setField('id_equipo_modelo', button.dataset.id ?? '');
  setField('modelo_equipo', button.dataset.modelo ?? '');
  setField('marca_equipo', button.dataset.nombre ?? '');
  const label = element('marca_display');
  label.textContent = `Marca: ${button.dataset.nombre ?? ''}`;
  label.className = 'text-primary small fw-bold';
});
document.getElementById('buscadorModal')?.addEventListener('input', (event) => {
  const value = (event.currentTarget as HTMLInputElement).value.toLocaleLowerCase();
  for (const row of document.querySelectorAll<HTMLElement>('#modalCatalogo tbody tr')) {
    row.hidden = !row.textContent?.toLocaleLowerCase().includes(value);
  }
});
