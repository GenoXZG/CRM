import { BusinessError, isRecord, positiveInteger } from '../domain/business-error';
import type { Unit } from '../domain/entities';
import { catalogs, tickets, units, withTransaction } from '../infrastructure/database/repositories';
import { getTicket } from './ticket-lifecycle';

export async function registerUnits(input: unknown, ticketId: unknown): Promise<Unit[]> {
  if (!Array.isArray(input) || !input.length)
    throw new BusinessError(400, 'No se enviaron unidades');
  return withTransaction(async (transaction) => {
    const ticket = await getTicket(ticketId, transaction, ['waiting']);
    if (input.length !== ticket.unitCount)
      throw new BusinessError(400, 'La cantidad de unidades debe coincidir con el ticket');
    if (await units.count(ticket.id, transaction))
      throw new BusinessError(409, 'El ticket ya tiene unidades registradas');
    const saved: Unit[] = [];
    for (const value of input) {
      if (!isRecord(value)) throw new BusinessError(400, 'Datos de unidad inválidos');
      if (positiveInteger(value.ticketId, 'Ticket') !== ticket.id)
        throw new BusinessError(400, 'Todas las unidades deben pertenecer al mismo ticket');
      const modelId = positiveInteger(value.modelId, 'Modelo de unidad');
      if (!(await catalogs.findUnitModel(modelId, transaction)))
        throw new BusinessError(400, 'Modelo de unidad no encontrado');
      if (
        typeof value.licensePlate !== 'string' ||
        !value.licensePlate.trim() ||
        typeof value.vin !== 'string' ||
        !value.vin.trim()
      )
        throw new BusinessError(400, 'Placa y VIN son obligatorios');
      saved.push(
        await units.create(
          {
            modelId,
            ticketId: ticket.id,
            equipmentId: null,
            licensePlate: value.licensePlate.trim(),
            vin: value.vin.trim(),
          },
          transaction,
        ),
      );
    }
    await tickets.update(ticket.id, { status: 'in_progress', assignmentStatus: 0 }, transaction);
    return saved;
  });
}
export const getUnitsByTicket = (ticketId: unknown) =>
  units.listDetails(positiveInteger(ticketId, 'Ticket'));
