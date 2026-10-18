import type { Transaction } from 'sequelize';
import { BusinessError, nullableText, positiveInteger } from '../domain/business-error';
import {
  AssignmentStatus,
  type CreateTicketInput,
  type ServiceType,
  type Ticket,
  type TicketPhoto,
  type TicketStatus,
  type UploadedPhoto,
} from '../domain/entities';
import {
  catalogs,
  clients,
  photos,
  technicians,
  tickets,
  withTransaction,
} from '../infrastructure/database/repositories';
import { getAssignmentSummary, getTicket } from './ticket-lifecycle';

const OPEN_STATES: readonly TicketStatus[] = ['waiting', 'in_progress'];
function isServiceType(value: unknown): value is ServiceType {
  return (
    value === 'installation' ||
    value === 'removal' ||
    value === 'inspection' ||
    value === 'recovery'
  );
}
async function getActiveTechnician(id: unknown, transaction: Transaction) {
  const technician = await technicians.findById(positiveInteger(id, 'Técnico'), transaction);
  if (!technician) throw new BusinessError(404, 'Técnico no encontrado');
  if (technician.status !== 'active') throw new BusinessError(409, 'El técnico debe estar activo');
  return technician;
}
export async function createTicket(input: CreateTicketInput): Promise<Ticket> {
  const clientId = positiveInteger(input.clientId, 'Cliente');
  const unitCount = positiveInteger(input.unitCount, 'Cantidad de unidades');
  if (!isServiceType(input.serviceType))
    throw new BusinessError(400, 'Tipo de servicio inválido u obligatorio');
  const serviceType = input.serviceType;
  const technicianId =
    input.technicianId === undefined ||
    input.technicianId === null ||
    input.technicianId === '' ||
    input.technicianId === 'null'
      ? null
      : positiveInteger(input.technicianId, 'Técnico');
  const dateValue = nullableText(input.scheduledAt, 'Fecha de servicio');
  const scheduledAt = dateValue ? new Date(dateValue) : null;
  if (scheduledAt && Number.isNaN(scheduledAt.getTime()))
    throw new BusinessError(400, 'Fecha de servicio inválida');
  const locationUrl = nullableText(input.locationUrl, 'Ubicación', 255);
  const comments = nullableText(input.comments, 'Comentarios');
  return withTransaction(async (transaction) => {
    if (!(await clients.findById(clientId, transaction)))
      throw new BusinessError(404, 'Cliente no encontrado');
    if (technicianId !== null) await getActiveTechnician(technicianId, transaction);
    return tickets.create(
      {
        clientId,
        technicianId,
        serviceType,
        unitCount,
        scheduledAt,
        locationUrl,
        comments,
        status: 'waiting',
        assignmentStatus: AssignmentStatus.Pending,
      },
      transaction,
    );
  });
}
export async function getTicketDetails(id: unknown) {
  const ticket = await tickets.findDetails(positiveInteger(id, 'Ticket'));
  if (!ticket) throw new BusinessError(404, 'Ticket no encontrado');
  return ticket;
}
export const getWaitingTickets = () => tickets.list('waiting');
export const getUnitModels = () => catalogs.listUnitModels();
export const getTicketsAwaitingEquipment = () => tickets.list('in_progress', true);
export const confirmCompleteAssignment = (id: unknown) =>
  withTransaction(async (transaction) => {
    const ticket = await getTicket(id, transaction, ['in_progress']);
    const summary = await getAssignmentSummary(ticket, transaction);
    if (!summary.complete) throw new BusinessError(409, 'La asignación no está completa');
    await tickets.update(ticket.id, { assignmentStatus: summary.status }, transaction);
  });
export async function getTicketDashboard() {
  const all = await tickets.list();
  return {
    waitingTickets: all.filter((ticket) => ticket.status === 'waiting'),
    inProgressTickets: all.filter((ticket) => ticket.status === 'in_progress'),
    completedTickets: all.filter((ticket) => ticket.status === 'completed'),
  };
}
export const updateLocation = (id: unknown, value: unknown) =>
  withTransaction(async (transaction) => {
    const ticket = await getTicket(id, transaction, OPEN_STATES);
    const url = nullableText(value, 'Ubicación', 255);
    if (url) {
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        throw new BusinessError(400, 'Enlace de ubicación inválido');
      }
      if (!['https:', 'http:'].includes(parsed.protocol))
        throw new BusinessError(400, 'Enlace de ubicación inválido');
    }
    await tickets.update(ticket.id, { locationUrl: url }, transaction);
  });
export const updateComments = (id: unknown, value: unknown) =>
  withTransaction(async (transaction) => {
    const ticket = await getTicket(id, transaction, OPEN_STATES);
    await tickets.update(ticket.id, { comments: nullableText(value, 'Comentarios') }, transaction);
  });
export const assignTechnician = (id: unknown, technicianId: unknown) =>
  withTransaction(async (transaction) => {
    const ticket = await getTicket(id, transaction, OPEN_STATES);
    const technician = await getActiveTechnician(technicianId, transaction);
    await tickets.update(ticket.id, { technicianId: technician.id }, transaction);
  });
export const completeTicket = (id: unknown) =>
  withTransaction(async (transaction) => {
    const ticket = await getTicket(id, transaction, ['in_progress']);
    const summary = await getAssignmentSummary(ticket, transaction);
    if (!summary.complete)
      throw new BusinessError(
        409,
        'Todas las unidades previstas deben tener equipo antes de finalizar',
      );
    await tickets.update(
      ticket.id,
      { status: 'completed', assignmentStatus: summary.status },
      transaction,
    );
  });
export const reopenTicket = (id: unknown) =>
  withTransaction(async (transaction) => {
    const ticket = await getTicket(id, transaction, ['completed']);
    await tickets.update(ticket.id, { status: 'in_progress' }, transaction);
  });
export const requireOpenTicket = (id: unknown) => getTicket(id, undefined, OPEN_STATES);
export const savePhotos = (id: unknown, files: readonly UploadedPhoto[]) =>
  withTransaction(async (transaction) => {
    const ticket = await getTicket(id, transaction, OPEN_STATES);
    const saved: TicketPhoto[] = [];
    for (const file of files)
      saved.push(
        await photos.create(
          ticket.id,
          `/uploads/tickets/${file.filename}`,
          file.originalname,
          transaction,
        ),
      );
    return saved;
  });
