import type { Transaction } from 'sequelize';
import { BusinessError, positiveInteger } from '../domain/business-error';
import {
  AssignmentStatus,
  type AssignmentSummary,
  type Ticket,
  type TicketStatus,
} from '../domain/entities';
import { tickets, units } from '../infrastructure/database/repositories';

export async function getTicket(
  id: unknown,
  transaction?: Transaction,
  allowedStates?: readonly TicketStatus[],
): Promise<Ticket> {
  const ticket = await tickets.findById(
    positiveInteger(id, 'Ticket'),
    transaction,
    Boolean(transaction),
  );
  if (!ticket) throw new BusinessError(404, 'Ticket no encontrado');
  if (allowedStates && (!ticket.status || !allowedStates.includes(ticket.status))) {
    throw new BusinessError(409, 'Esta operación no está permitida en el estado actual del ticket');
  }
  return ticket;
}
export async function getAssignmentSummary(
  ticket: Ticket,
  transaction?: Transaction,
): Promise<AssignmentSummary> {
  const total = await units.count(ticket.id, transaction);
  const equipped = await units.count(ticket.id, transaction, true);
  const complete = total > 0 && total === ticket.unitCount && equipped === total;
  return {
    total,
    equipped,
    complete,
    status:
      equipped === 0
        ? AssignmentStatus.Pending
        : complete
          ? AssignmentStatus.Complete
          : AssignmentStatus.Partial,
  };
}
export async function updateAssignmentStatus(
  ticket: Ticket,
  transaction: Transaction,
): Promise<AssignmentSummary> {
  const summary = await getAssignmentSummary(ticket, transaction);
  await tickets.update(ticket.id, { assignmentStatus: summary.status }, transaction);
  return summary;
}
