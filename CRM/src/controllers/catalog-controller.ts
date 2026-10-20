import type { Request, Response } from 'express';
import { respondError } from '../adapters/http-errors';
import { equipmentPage, unitPage, accessoryPage, type CatalogQuery } from '../infrastructure/database/catalog-repository';

const keys = ['equipment', 'units', 'accessories'] as const;
export async function renderCatalogs(request: Request, response: Response) {
  try {
    const state = new URLSearchParams();
    const queries = keys.map(key => {
      const text = request.query[`${key}_search`];
      const size = Number(request.query[`${key}_size`]);
      const page = Number(request.query[`${key}_page`]);
      const query: CatalogQuery = { search: typeof text === 'string' ? text.trim().slice(0, 255) : '', size: [5, 10, 25, 50].includes(size) ? size : 5, page: Number.isSafeInteger(page) && page > 0 ? page : 1 };
      state.set(`${key}_search`, query.search);
      state.set(`${key}_size`, String(query.size));
      return query;
    });
    const equipment = await equipmentPage(queries[0]!);
    const units = await unitPage(queries[1]!);
    const accessories = await accessoryPage(queries[2]!);
    const catalogs = [
      { ...equipment, key: 'equipment', title: 'Equipos', icon: 'motherboard', fields: [{ name: 'Marca_equipo', label: 'Marca', property: 'brand' }, { name: 'Modelo_equipo', label: 'Modelo', property: 'model' }], idField: 'ID_equipo_modelo', create: '/add_equipo_catalogo', update: '/editar_equipo_stock', remove: '/eliminar_equipo_stock' },
      { ...units, key: 'units', title: 'Unidades', icon: 'truck', fields: [{ name: 'Marca_unidad', label: 'Marca', property: 'brand' }, { name: 'Modelo_Unidad', label: 'Modelo', property: 'model' }], idField: 'ID_Unidad_modelo', create: '/add_unidad_catalogo', update: '/editar_unidad_stock', remove: '/eliminar_unidad_stock' },
      { ...accessories, key: 'accessories', title: 'Accesorios', icon: 'plug', fields: [{ name: 'Nombre_accesorio', label: 'Nombre', property: 'name' }], idField: 'ID_accesorio_modelo', create: '/add_accesorio_catalogo', update: '/editar_accesorio_stock', remove: '/eliminar_accesorio_stock' },
    ];
    for (const catalog of catalogs) state.set(`${catalog.key}_page`, String(catalog.page));
    const setup = typeof request.query.setup === 'string' && keys.includes(request.query.setup as typeof keys[number]) ? request.query.setup : '';
    if (setup) state.set('setup', setup);
    response.render('catalogos', { catalogs, state, setupWizard: setup, pageUrl: (key: string, page: number) => {
      const params = new URLSearchParams(state); params.set(`${key}_page`, String(page));
      return `/catalogos?${params}#${key}`;
    } });
  } catch (error) { respondError(response, error); }
}
