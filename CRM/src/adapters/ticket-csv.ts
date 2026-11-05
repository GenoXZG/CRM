import type { TicketSummary } from '../domain/entities';
import { serviceTypeToDatabase, ticketStatusToDatabase } from '../infrastructure/database/mapping';

// Quote every cell and neutralize spreadsheet formulas in user-controlled text.
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[\s\uFEFF]*[=+@-]/u.test(text) || /^[\t\r\n]/u.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

function date(value: Date | null, timeZone: string): string {
  if (!value) return '';
  const parts = new Intl.DateTimeFormat('sv-SE', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(value);
  return parts;
}

export async function* ticketCsv(tickets: AsyncIterable<TicketSummary>) {
  yield '\uFEFF' + ['Ticket', 'Cliente', 'Técnico', 'Tipo de servicio', 'Estado', 'Unidades previstas', 'Preparación', 'Fecha de servicio (hora capturada)', 'Fecha de cierre (Ciudad de México)', 'Ubicación', 'Comentarios'].map(csvCell).join(',') + '\r\n';
  for await (const ticket of tickets) {
    yield [ticket.id, ticket.client?.companyName, ticket.technician?.name,
      ticket.serviceType ? serviceTypeToDatabase[ticket.serviceType] : '',
      ticket.status ? ticketStatusToDatabase[ticket.status] : '', ticket.unitCount,
      ({ 0: 'Pendiente', 1: 'Completa', 2: 'Parcial' })[ticket.assignmentStatus],
      date(ticket.scheduledAt, 'UTC'), date(ticket.closedAt, 'America/Mexico_City'),
      ticket.locationUrl, ticket.comments].map(csvCell).join(',') + '\r\n';
  }
}
