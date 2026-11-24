import { QueryTypes } from 'sequelize';
import { database } from '../infrastructure/database/connection';
import { requireActiveTechnician } from '../domain/technician-access';
import type { Transaction } from 'sequelize';
import { BusinessError, nullableText, positiveInteger } from '../domain/business-error';
import {
  AssignmentStatus,
  type CreateTicketInput,
  type EquipmentStatus,
  type ServiceType,
  type Ticket,
  type TicketPhoto,
  type TicketStatus,
  type UploadedPhoto,
} from '../domain/entities';
import {
  clients,
  equipment,
  photos,
  technicians,
  tickets,
  units,
  withTransaction,
} from '../infrastructure/database/repositories';
import { getAssignmentSummary, getTicket } from './ticket-lifecycle';
import { locationUrl as validateLocationUrl } from '../domain/location';

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
  const locationUrl = validateLocationUrl(input.locationUrl);
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
        closedAt: null,
        locationUrl,
        comments,
        status: 'waiting',
        assignmentStatus: AssignmentStatus.Pending,
      },
      transaction,
    );
  });
}
export async function getTicketDetails(id: unknown, transaction: Transaction, technicianScope?: number) {
  const ticket = await tickets.findDetails(positiveInteger(id, 'Ticket'), transaction, technicianScope);
  if (!ticket) throw new BusinessError(404, 'Ticket no encontrado');
  return ticket;
}
export async function getEquipmentAssignmentTickets() {
  const [waiting, inProgress] = await Promise.all([tickets.list('waiting'), tickets.list('in_progress')]);
  return [...waiting, ...inProgress].sort((left, right) => right.id - left.id);
}
export const confirmCompleteAssignment = (id: unknown) =>
  withTransaction(async (transaction) => {
    const ticket = await getTicket(id, transaction, ['in_progress']);
    const summary = await getAssignmentSummary(ticket, transaction);
    if (!summary.complete) throw new BusinessError(409, 'La asignación no está completa');
    await tickets.update(ticket.id, { assignmentStatus: summary.status }, transaction);
  });
export const updateLocation = (id: unknown, value: unknown) =>
  withTransaction(async (transaction) => {
    const ticket = await getTicket(id, transaction, OPEN_STATES);
    const url = validateLocationUrl(value);
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
interface ClosingActor {
  userId: number;
  role: string;
  sessionHash: string;
  technicianId?: number;
}
export const completeTicket = (id: unknown, actor?: ClosingActor) =>
  withTransaction(async (transaction) => {
    if (actor) {
      const [user] = await database.query<{ rol: string; id_tecnico: number | null; tecnico_estado: string | null }>('SELECT u.rol,u.id_tecnico,(SELECT Estatus_tecnico FROM Tecnicos WHERE ID_Tecnico=u.id_tecnico) AS tecnico_estado FROM usuarios u WHERE u.id=? FOR UPDATE', { replacements: [actor.userId], transaction, type: QueryTypes.SELECT });
      if (!user || user.rol !== actor.role || (actor.role === 'tecnico' && user.id_tecnico !== actor.technicianId))
        throw new BusinessError(403, 'Tu cuenta cambió. Inicia sesión nuevamente.');
      requireActiveTechnician(user);
      const [session] = await database.query('SELECT 1 FROM sesiones_usuario WHERE token_hash=? AND id_usuario=? AND segundo_factor=1 AND expira_en>UTC_TIMESTAMP() FOR UPDATE',
        { replacements: [actor.sessionHash, actor.userId], transaction, type: QueryTypes.SELECT });
      if (!session) throw new BusinessError(401, 'Debes iniciar sesión.');
    }
    const ticket = await getTicket(id, transaction);
    if (actor?.role === 'tecnico' && ticket.technicianId !== actor.technicianId) throw new BusinessError(404, 'Ticket no encontrado');
    if (ticket.status !== 'in_progress') throw new BusinessError(409, 'El ticket debe estar en seguimiento para finalizar');
    const summary = await getAssignmentSummary(ticket, transaction);
    if (!summary.complete)
      throw new BusinessError(
        409,
        'Todas las unidades previstas deben tener equipo antes de finalizar',
      );
    await updateTicketEquipmentStatus(ticket.id, 'installed', transaction);
    await tickets.update(
      ticket.id,
      { status: 'completed', assignmentStatus: summary.status },
      transaction,
    );
  });
export const reopenTicket = (id: unknown) =>
  withTransaction(async (transaction) => {
    const ticket = await getTicket(id, transaction, ['completed']);
    await updateTicketEquipmentStatus(ticket.id, 'assigned', transaction);
    await tickets.update(ticket.id, { status: 'in_progress' }, transaction);
  });

async function updateTicketEquipmentStatus(
  ticketId: number,
  status: EquipmentStatus,
  transaction: Transaction,
): Promise<void> {
  // Keep the same lock order as assignments: ticket, units, then equipment.
  const ticketUnits = await units.findByTicket(ticketId, transaction);
  const ids = [...new Set(ticketUnits.flatMap((unit) => unit.equipmentId === null ? [] : [unit.equipmentId]))];
  if (!ids.length) return;
  const devices = await equipment.findForAssignment(ids, transaction);
  if (devices.length !== ids.length)
    throw new BusinessError(409, 'No se encontraron todos los equipos del servicio');
  for (const device of devices)
    await equipment.setStatus(device.id, status, transaction);
}
export const requireOpenTicket = (id: unknown) => getTicket(id, undefined, OPEN_STATES);
export const savePhotos = (id: unknown, files: readonly UploadedPhoto[], ensureConnected = () => {}) =>
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
    ensureConnected();
    return saved;
  });
