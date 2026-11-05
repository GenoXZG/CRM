import { QueryTypes, Op, type Attributes, type Model, type ModelStatic, type WhereOptions } from 'sequelize';
import { database, clientModel, technicianModel, ticketModel } from './models';
import { mapClient, mapTechnician } from './mapping';

export interface DirectoryQuery {
  search: string;
  page: number;
  size: number;
  status: '' | 'active' | 'inactive';
}

async function directoryPage<Row extends Model, Entity extends { id: number }>(
  model: ModelStatic<Row>,
  fields: string[],
  map: (row: Row) => Entity,
  query: DirectoryQuery,
  ticketField: 'ID_cliente' | 'ID_tecnico',
) {
  const term = query.search.replace(/[\\%_]/g, '\\$&');
  const conditions = [
    ...(term ? [{ [Op.or]: fields.map(field => ({ [field]: { [Op.like]: `%${term}%` } })) }] : []),
    ...(ticketField === 'ID_tecnico' && query.status ? [{ Estatus_tecnico: query.status === 'active' ? 'Activo' : 'Inactivo' }] : []),
  ];
  const where = { [Op.and]: conditions } as WhereOptions<Attributes<Row>>;
  const count = await model.count({ where });
  const pages = Math.max(1, Math.ceil(count / query.size));
  const page = Math.min(query.page, pages);
  const records = await model.findAll({ where, limit: query.size, offset: (page - 1) * query.size, order: [[model.primaryKeyAttribute, 'DESC']] });
  const rows = records.map(map);
  // Fetch references for the visible page only, without loading ticket details.
  const references = rows.length ? await ticketModel.findAll({
    attributes: [ticketField],
    where: { [ticketField]: { [Op.in]: rows.map(row => row.id) } },
    group: [ticketField],
  }) : [];
  const linked = new Set(references.map(row => row[ticketField]));
  if (ticketField === 'ID_tecnico' && rows.length) {
    const accounts = await database.query<{ id_tecnico: number }>('SELECT id_tecnico FROM usuarios WHERE id_tecnico IN (:ids)', { replacements: { ids: rows.map(row => row.id) }, type: QueryTypes.SELECT });
    for (const account of accounts) linked.add(account.id_tecnico);
  }
  return { rows: rows.map(row => ({ ...row, linked: linked.has(row.id) })), count, pages, page, size: query.size, search: query.search, status: query.status };
}

export const clientPage = (query: DirectoryQuery) => directoryPage(clientModel, ['Nombre_empresa', 'Encargado', 'Numero'], mapClient, query, 'ID_cliente');
export const technicianPage = (query: DirectoryQuery) => directoryPage(technicianModel, ['Nombre_tecnico', 'Numero_tecnico'], mapTechnician, query, 'ID_tecnico');
