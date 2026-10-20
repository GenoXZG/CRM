import { BusinessError, isRecord, positiveInteger } from '../domain/business-error';
import type { Unit } from '../domain/entities';
import { catalogs, equipment, tickets, units, withTransaction } from '../infrastructure/database/repositories';
import { getTicket, updateAssignmentStatus } from './ticket-lifecycle';

export async function registerUnits(
  input: unknown, ticketId: unknown, reducePlannedCount = false, expectedUnitCount?: unknown,
): Promise<Unit[]> {
  if (!Array.isArray(input) || !input.length)
    throw new BusinessError(400, 'No se enviaron unidades');
  return withTransaction(async (transaction) => {
    const ticket = await getTicket(ticketId, transaction, ['waiting']);
    if (reducePlannedCount && positiveInteger(expectedUnitCount, 'Cantidad prevista original') !== ticket.unitCount)
      throw new BusinessError(409, 'La cantidad del ticket cambió. Recarga la pantalla antes de continuar');
    if (input.length !== ticket.unitCount && !(reducePlannedCount && ticket.unitCount !== null && input.length < ticket.unitCount))
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
    await tickets.update(ticket.id, { status: 'in_progress', assignmentStatus: 0, unitCount: input.length }, transaction);
    return saved;
  });
}
export const getUnitsByTicket = (ticketId: unknown) =>
  units.listDetails(positiveInteger(ticketId, 'Ticket'));

// Lock the ticket before its unit/device, as in assignment and completion operations.
export async function removeUnit(ticketId: unknown, unitId: unknown) {
  return withTransaction(async transaction => {
    const ticket = await getTicket(ticketId, transaction, ['in_progress']);
    const id = positiveInteger(unitId, 'Unidad');
    const unit = await units.findById(id, transaction, true);
    if (!unit) throw new BusinessError(404, 'Unidad no encontrada');
    if (unit.ticketId !== ticket.id)
      throw new BusinessError(400, 'La unidad no pertenece al ticket');
    const planned = positiveInteger(ticket.unitCount, 'Cantidad de unidades');
    if (planned <= 1)
      throw new BusinessError(409, 'No se puede quitar la última unidad: el ticket debe conservar al menos una unidad');
    if (unit.equipmentId !== null) {
      const device = await equipment.findById(unit.equipmentId, transaction);
      if (!device) throw new BusinessError(409, 'No se encontró el equipo de la unidad');
      await units.setEquipment(unit.id, null, transaction);
      await equipment.setStatus(device.id, 'pending_assignment', transaction);
    }
    await units.remove(unit.id, transaction);
    const unitCount = planned - 1;
    await tickets.update(ticket.id, { unitCount }, transaction);
    const summary = await updateAssignmentStatus({ ...ticket, unitCount }, transaction);
    return { success: true, message: 'Unidad retirada del ticket. La cantidad prevista y el avance se actualizaron.', unitCount, assignmentStatus: summary.status };
  });
}
