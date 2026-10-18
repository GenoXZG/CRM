import type { DashboardMetrics, Ticket, TicketStatus } from '../domain/entities';
import { serviceTypeToDatabase, ticketStatusToDatabase } from '../infrastructure/database/mapping';

export const serializeDashboardMetrics = (metrics: DashboardMetrics) => ({
  totalTickets: metrics.totalTickets,
  counts: {
    espera: metrics.counts.waiting,
    seguimiento: metrics.counts.in_progress,
    finalizado: metrics.counts.completed,
  },
  topTecnicos: metrics.technicianWorkload.map((technician) => ({
    nombre: technician.name,
    tickets_activos: technician.activeTickets,
  })),
  equiposStockBajo: metrics.equipmentAvailability.map((model) => ({
    Modelo_equipo: model.model,
    disponibles: model.available,
  })),
});
const colors: Record<TicketStatus, [string, string]> = {
  waiting: ['#fff5cc', '#d9a600'],
  in_progress: ['#dbeafe', '#1e40af'],
  completed: ['#d1fae5', '#065f46'],
};
export function serializeCalendarTicket(ticket: Ticket) {
  const [backgroundColor, textColor] = ticket.status
    ? colors[ticket.status]
    : ['#f4f7fe', '#6c757d'];
  return {
    id: ticket.id,
    title: `#${ticket.id} - ${ticket.serviceType ? serviceTypeToDatabase[ticket.serviceType] : null}`,
    start: ticket.scheduledAt,
    backgroundColor,
    borderColor: 'transparent',
    textColor,
    status: ticket.status ? ticketStatusToDatabase[ticket.status] : null,
  };
}
