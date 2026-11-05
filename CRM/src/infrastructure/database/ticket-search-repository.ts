import { operatingToday } from '../../domain/dashboard-period';
import { activeTicketSql, incompleteTicketSql } from './ticket-attention';
import { QueryTypes, literal, Op, type WhereOptions } from 'sequelize';
import type { TicketStatus } from '../../domain/entities';
import { database, ticketModel, clientModel, technicianModel, type TicketAttributes } from './models';
import { mapClient, mapTechnician, mapTicketSummary, ticketStatusToDatabase } from './mapping';

export interface TicketSearch {
  attention: '' | 'active' | 'overdue' | 'unassigned' | 'incomplete';
  search: string;
  status: TicketStatus | '';
  client: number | null;
  technician: number | null;
  dateFrom: string;
  dateTo: string;
  page: number;
  size: number;
}
function ticketSearchWhere(query: TicketSearch, technicianScope?: number): WhereOptions<TicketAttributes> {
  const conditions: WhereOptions<TicketAttributes>[] = [];
  if (technicianScope !== undefined) conditions.push({ ID_tecnico: technicianScope });
  if (query.attention) {
    conditions.push(literal(activeTicketSql('`Ticket`')) as unknown as WhereOptions<TicketAttributes>);
    if (query.attention === 'overdue') conditions.push({ Fecha_servicio: { [Op.lt]: new Date(`${operatingToday()}T00:00:00Z`) } });
    if (query.attention === 'unassigned') conditions.push({ ID_tecnico: null });
    if (query.attention === 'incomplete') conditions.push(literal(incompleteTicketSql('`Ticket`')) as unknown as WhereOptions<TicketAttributes>);
  }
  if (query.status) conditions.push({ Estatus_servicio: ticketStatusToDatabase[query.status] });
  if (query.client) conditions.push({ ID_cliente: query.client });
  if (query.technician) conditions.push({ ID_tecnico: query.technician });
  if (query.search) {
    const term = `%${query.search.replace(/[\\%_]/g, '\\$&')}%`;
    const number = Number(query.search.replace(/^#/, ''));
    conditions.push({ [Op.or]: [
      { '$Cliente.Nombre_empresa$': { [Op.like]: term } },
      { '$Tecnico.Nombre_tecnico$': { [Op.like]: term } },
      ...(Number.isInteger(number) && number > 0 && number <= 2147483647 ? [{ ID_ticket: number }] : []),
    ] });
  }
  if (query.dateFrom) conditions.push({ Fecha_servicio: { [Op.gte]: new Date(`${query.dateFrom}T00:00:00.000Z`) } });
  if (query.dateTo) {
    const next = new Date(`${query.dateTo}T00:00:00.000Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    conditions.push({ Fecha_servicio: { [Op.lt]: next } });
  }
  return { [Op.and]: conditions };
}

export async function searchTickets(query: TicketSearch, technicianScope?: number) {
  const where = ticketSearchWhere(query, technicianScope);
  const include = [{ model: clientModel }, { model: technicianModel, required: false }];
  const count = await ticketModel.count({ where, include });
  const pages = Math.max(1, Math.ceil(count / query.size));
  const page = Math.min(query.page, pages);
  const rows = await ticketModel.findAll({ where, include, order: [['ID_ticket', 'DESC']], limit: query.size, offset: (page - 1) * query.size });
  return { tickets: rows.map(mapTicketSummary), count, pages, page, size: query.size };
}

export async function getScopedTicketFilterOptions(technician: number) {
  const ids = await database.query<{ ID_cliente: number }>('SELECT DISTINCT ID_cliente FROM Tickets WHERE ID_tecnico=?', { replacements: [technician], type: QueryTypes.SELECT });
  const [clients, tech] = await Promise.all([
    clientModel.findAll({ where: { ID_cliente: { [Op.in]: ids.map(row => row.ID_cliente) } } }),
    technicianModel.findByPk(technician),
  ]);
  return { clients: clients.map(mapClient), technicians: tech ? [mapTechnician(tech)] : [] };
}

// Keyset batches keep memory bounded and avoid duplicates when earlier rows change.
export async function* exportTickets(query: TicketSearch, technicianScope?: number) {
  let beforeId: number | undefined;
  while (true) {
    const where: WhereOptions<TicketAttributes> = { [Op.and]: [
      ticketSearchWhere(query, technicianScope),
      ...(beforeId === undefined ? [] : [{ ID_ticket: { [Op.lt]: beforeId } }]),
    ] };
    const rows = await ticketModel.findAll({ where, include: [{ model: clientModel }, { model: technicianModel, required: false }], order: [['ID_ticket', 'DESC']], limit: 500 });
    if (!rows.length) return;
    const tickets = rows.map(mapTicketSummary);
    for (const ticket of tickets) yield ticket;
    beforeId = tickets[tickets.length - 1]!.id;
    if (tickets.length < 500) return;
  }
}
