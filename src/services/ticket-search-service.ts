import { BusinessError, positiveInteger } from '../domain/business-error';
import { searchTickets, type TicketSearch } from '../infrastructure/database/ticket-search-repository';

function text(value: unknown) { return typeof value === 'string' ? value.trim() : ''; }
function date(value: unknown, field: string) {
  const input = text(value);
  if (!input) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input) || Number.isNaN(Date.parse(input)) || new Date(input).toISOString().slice(0, 10) !== input || input < '1000-01-01' || input > '9999-12-30')
    throw new BusinessError(400, `${field} no es una fecha válida`);
  return input;
}
export async function getTicketList(input: Record<string, unknown>) {
  const status = text(input.status);
  if (status && status !== 'waiting' && status !== 'in_progress' && status !== 'completed')
    throw new BusinessError(400, 'Estatus de ticket inválido');
  const dateFrom = date(input.dateFrom, 'Fecha inicial');
  const dateTo = date(input.dateTo, 'Fecha final');
  if (dateFrom && dateTo && dateFrom > dateTo) throw new BusinessError(400, 'La fecha inicial debe ser anterior o igual a la final');
  const page = Number(input.page);
  const size = Number(input.size);
  const filters: TicketSearch = {
    search: text(input.search).slice(0, 255), status: status as TicketSearch['status'],
    client: text(input.client) ? positiveInteger(input.client, 'Cliente') : null,
    technician: text(input.technician) ? positiveInteger(input.technician, 'Técnico') : null,
    dateFrom, dateTo,
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    size: [5, 10, 25, 50].includes(size) ? size : 10,
  };
  return { ...(await searchTickets(filters)), filters };
}
