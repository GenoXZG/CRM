import { BusinessError, isRecord, nullableText, positiveInteger } from '../domain/business-error';
import type { CreateEquipmentInput } from '../domain/entities';
import {
  accessories,
  catalogs,
  equipment,
  units,
  withTransaction,
} from '../infrastructure/database/repositories';
import { getTicket, updateAssignmentStatus } from './ticket-lifecycle';

export const createEquipment = (input: CreateEquipmentInput) =>
  equipment.create(
    positiveInteger(input.modelId, 'Modelo de equipo'),
    nullableText(input.imei, 'IMEI', 100),
    nullableText(input.modemId, 'Módem', 100),
  );
export const getEquipmentModels = () => catalogs.listEquipmentModels();
export const getEquipmentInventory = () => equipment.list();
export const getAvailableEquipment = () => equipment.list('pending_assignment');

export async function assignEquipment(input: unknown, ticketId: unknown) {
  if (!isRecord(input)) throw new BusinessError(400, 'Formato de asignación inválido');
  const equipmentInput = input.equipment === undefined ? {} : input.equipment;
  const accessoryInput = input.accessories === undefined ? {} : input.accessories;
  if (!isRecord(equipmentInput) || !isRecord(accessoryInput))
    throw new BusinessError(400, 'Formato de asignación inválido');
  const assignments = new Map<number, number>();
  const selectedEquipment = new Set<number>();
  for (const [unitId, equipmentId] of Object.entries(equipmentInput)) {
    const unit = positiveInteger(unitId, 'Unidad');
    const device = positiveInteger(equipmentId, 'Equipo');
    if (assignments.has(unit) || selectedEquipment.has(device))
      throw new BusinessError(409, 'Un equipo solo puede asignarse a una unidad');
    assignments.set(unit, device);
    selectedEquipment.add(device);
  }
  const selectedAccessories = new Map<number, number[]>();
  for (const [unitId, list] of Object.entries(accessoryInput)) {
    if (!Array.isArray(list)) throw new BusinessError(400, 'Lista de accesorios inválida');
    selectedAccessories.set(positiveInteger(unitId, 'Unidad'), [
      ...new Set(
        list.map((value: unknown) => {
          if (!isRecord(value)) throw new BusinessError(400, 'Accesorio inválido');
          return positiveInteger(value.id, 'Accesorio');
        }),
      ),
    ]);
  }
  const unitIds = [...new Set([...assignments.keys(), ...selectedAccessories.keys()])].sort(
    (a, b) => a - b,
  );
  if (!assignments.size && ![...selectedAccessories.values()].some((list) => list.length))
    throw new BusinessError(400, 'No hay asignaciones para procesar');
  return withTransaction(async (transaction) => {
    const ticket = await getTicket(ticketId, transaction, ['in_progress']);
    const selectedUnits = await units.findForAssignment(ticket.id, unitIds, transaction);
    if (selectedUnits.length !== unitIds.length)
      throw new BusinessError(400, 'Las unidades deben pertenecer al ticket');
    const unitsById = new Map(selectedUnits.map((unit) => [unit.id, unit]));
    const devices = await equipment.findForAssignment([...selectedEquipment], transaction);
    if (devices.length !== selectedEquipment.size)
      throw new BusinessError(404, 'Equipo no encontrado');
    const devicesById = new Map(devices.map((device) => [device.id, device]));
    for (const [unitId, equipmentId] of assignments) {
      const unit = unitsById.get(unitId);
      const device = devicesById.get(equipmentId);
      if (!unit || !device) throw new BusinessError(400, 'Asignación inválida');
      if (unit.equipmentId !== null && unit.equipmentId !== equipmentId)
        throw new BusinessError(409, 'Retira el equipo actual antes de asignar otro');
      // Repeated saved assignments are idempotent; taking an occupied device is not.
      if (unit.equipmentId !== equipmentId && device.status !== 'pending_assignment')
        throw new BusinessError(409, 'El equipo no está disponible');
      const owner = await units.findByEquipmentId(equipmentId, transaction);
      if (owner && owner.id !== unitId)
        throw new BusinessError(409, 'El equipo ya está vinculado a otra unidad');
      await equipment.setStatus(device.id, 'assigned', transaction);
      await units.setEquipment(unit.id, equipmentId, transaction);
    }
    for (const [unitId, ids] of selectedAccessories) {
      for (const accessoryId of ids) {
        if (!(await catalogs.findAccessory(accessoryId, transaction)))
          throw new BusinessError(404, 'Accesorio no encontrado');
        await accessories.link(unitId, accessoryId, transaction);
      }
    }
    const summary = await updateAssignmentStatus(ticket, transaction);
    return {
      success: true,
      assignmentStatus: summary.status,
      message: summary.complete
        ? 'Asignación completa. Listo para instalación.'
        : `Asignación guardada (${summary.equipped}/${ticket.unitCount} unidades).`,
    };
  });
}
export const releaseEquipment = (unitId: unknown, equipmentId: unknown, ticketId: unknown) =>
  withTransaction(async (transaction) => {
    const ticket = await getTicket(ticketId, transaction, ['in_progress']);
    const unit = await units.findById(positiveInteger(unitId, 'Unidad'), transaction, true);
    const deviceId = positiveInteger(equipmentId, 'Equipo');
    if (!unit) throw new BusinessError(404, 'Unidad no encontrada');
    if (unit.ticketId !== ticket.id || unit.equipmentId !== deviceId)
      throw new BusinessError(400, 'El ticket, la unidad y el equipo no corresponden');
    const device = await equipment.findById(deviceId, transaction);
    if (!device) throw new BusinessError(404, 'Equipo no encontrado');
    await units.setEquipment(unit.id, null, transaction);
    await equipment.setStatus(device.id, 'pending_assignment', transaction);
    const summary = await updateAssignmentStatus(ticket, transaction);
    return {
      success: true,
      message: 'Equipo desvinculado correctamente',
      assignmentStatus: summary.status,
    };
  });
export const removeAccessory = (unitId: unknown, accessoryId: unknown) =>
  withTransaction(async (transaction) => {
    const id = positiveInteger(unitId, 'Unidad');
    const accessory = positiveInteger(accessoryId, 'Accesorio');
    const reference = await units.findById(id, transaction);
    if (!reference) throw new BusinessError(404, 'Unidad no encontrada');
    await getTicket(reference.ticketId, transaction, ['in_progress']);
    const unit = await units.findById(id, transaction, true);
    if (!unit || unit.ticketId !== reference.ticketId)
      throw new BusinessError(409, 'La unidad cambió durante la operación');
    if (!(await accessories.unlink(id, accessory, transaction)))
      throw new BusinessError(404, 'Accesorio no vinculado a la unidad');
    return { success: true, message: 'Accesorio removido correctamente' };
  });
