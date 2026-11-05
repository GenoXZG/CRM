import type { Request, Response } from 'express';
import { respondError } from '../adapters/http-errors';
import { BusinessError } from '../domain/business-error';
import { clientPage, technicianPage, type DirectoryQuery } from '../infrastructure/database/directory-repository';

export async function renderDirectory(request: Request, response: Response) {
  try {
    const state = new URLSearchParams();
    const readQuery = (key: string): DirectoryQuery => {
      const search = request.query[`${key}_search`];
      const size = Number(request.query[`${key}_size`]);
      const page = Number(request.query[`${key}_page`]);
      const status = key === 'technicians' ? request.query.technicians_status : '';
      if (status !== undefined && status !== '' && status !== 'active' && status !== 'inactive')
        throw new BusinessError(400, 'Estado de técnico inválido');
      const query: DirectoryQuery = {
        search: typeof search === 'string' ? search.trim().slice(0, 255) : '',
        size: [5, 10, 25, 50].includes(size) ? size : 5,
        page: Number.isSafeInteger(page) && page > 0 ? page : 1,
        status: status || '',
      };
      state.set(`${key}_search`, query.search);
      state.set(`${key}_size`, String(query.size));
      if (key === 'technicians') state.set('technicians_status', query.status);
      return query;
    };
    const clientQuery = readQuery('clients');
    const technicianQuery = readQuery('technicians');
    const [clients, technicians] = await Promise.all([clientPage(clientQuery), technicianPage(technicianQuery)]);
    const directories = [
      { ...clients, key: 'clients', title: 'Clientes', singular: 'cliente', description: 'Empresas y sus contactos para la atención de servicios.', searchLabel: 'Buscar por empresa, encargado o teléfono', idField: 'ID_cliente', create: '/add_cliente', update: '/editar_cliente', remove: '/eliminar_cliente', fields: [
        { name: 'Nombre_empresa', property: 'companyName', label: 'Empresa', maximum: 100, type: 'text' },
        { name: 'Encargado', property: 'contactName', label: 'Encargado', maximum: 50, type: 'text' },
        { name: 'Numero', property: 'phone', label: 'Teléfono', maximum: 30, type: 'tel' },
      ] },
      { ...technicians, key: 'technicians', title: 'Técnicos', singular: 'técnico', description: 'Personal de campo y disponibilidad para nuevas asignaciones.', searchLabel: 'Buscar por nombre o teléfono', idField: 'ID_Tecnico', create: '/add_tecnico', update: '/editar_tecnico', remove: '/eliminar_tecnico', fields: [
        { name: 'Nombre_tecnico', property: 'name', label: 'Nombre completo', maximum: 255, type: 'text' },
        { name: 'Numero_tecnico', property: 'phone', label: 'Teléfono', maximum: 30, type: 'tel' },
        { name: 'Estatus_tecnico', property: 'status', label: 'Estado', maximum: 0, type: 'status' },
      ] },
    ];
    for (const directory of directories) state.set(`${directory.key}_page`, String(directory.page));
    const setupWizard = request.query.setup === 'clients' || request.query.setup === 'technicians' ? request.query.setup : '';
    if (setupWizard) state.set('setup', setupWizard);
    const focus = setupWizard || (request.path === '/tecnicos' ? 'technicians' : request.path === '/clientes' ? 'clients' : '');
    const notices: Record<string, string> = { create: 'Registro agregado correctamente.', edit: 'Datos actualizados correctamente.', delete: 'Registro eliminado correctamente.' };
    const notice = typeof request.query.notice === 'string' ? notices[request.query.notice] ?? '' : '';
    response.render('directorio', { directories, state, setupWizard, focus, notice, pageUrl: (key: string, page: number) => {
      const params = new URLSearchParams(state);
      params.set(`${key}_page`, String(page));
      return `/directorio?${params}#${key}`;
    } });
  } catch (error) { respondError(response, error); }
}
