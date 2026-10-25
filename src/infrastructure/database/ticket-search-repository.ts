import { Op, type WhereOptions } from 'sequelize';
import type { TicketStatus } from '../../domain/entities';
import { ticketModel, clientModel, technicianModel, type TicketAttributes } from './models';
import { mapTicketSummary, ticketStatusToDatabase } from './mapping';

export interface TicketSearch {
  search: string;
  status: TicketStatus | '';
  client: number | null;
  technician: number | null;
  dateFrom: string;
  dateTo: string;
  page: number;
  size: number;
}
export async function searchTickets(query: TicketSearch) {
  const conditions: WhereOptions<TicketAttributes>[] = [];
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
  const where: WhereOptions<TicketAttributes> = { [Op.and]: conditions };
  const include = [{ model: clientModel }, { model: technicianModel, required: false }];
  const count = await ticketModel.count({ where, include });
  const pages = Math.max(1, Math.ceil(count / query.size));
  const page = Math.min(query.page, pages);
  const rows = await ticketModel.findAll({ where, include, order: [['ID_ticket', 'DESC']], limit: query.size, offset: (page - 1) * query.size });
  return { tickets: rows.map(mapTicketSummary), count, pages, page, size: query.size };
}
