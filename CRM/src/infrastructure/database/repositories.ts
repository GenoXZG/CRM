import { changesBetween, recordTicketEvent } from './ticket-history-repository';
import {
  accessoryCatalogRepository,
  clientRepository,
  equipmentCatalogRepository,
  technicianRepository,
  unitCatalogRepository,
} from './master-data-repository';
import { literal, Op, type Transaction } from 'sequelize';
import type {
  Equipment,
  EquipmentStatus,
  Ticket,
  TicketDetails,
  TicketStatus,
  TicketSummary,
  Unit,
  UnitDetails,
} from '../../domain/entities';
import {
  accessoryModel,
  clientModel,
  database,
  equipmentCatalogModel,
  equipmentModel,
  photoModel,
  technicianModel,
  ticketModel,
  unitAccessoryModel,
  unitCatalogModel,
  unitModel,
} from './models';
import {
  equipmentStatusToDatabase,
  mapAccessory,
  mapEquipment,
  mapPhoto,
  mapTicket,
  mapTicketDetails,
  mapTicketPatch,
  mapTicketSummary,
  mapUnit,
  mapUnitDetails,
  mapUnitModel,
  ticketStatusToDatabase,
} from './mapping';

function options(transaction?: Transaction, lock = false) {
  return { transaction, ...(transaction && lock ? { lock: transaction.LOCK.UPDATE } : {}) };
}
export function withTransaction<T>(
  operation: (transaction: Transaction) => Promise<T>,
): Promise<T> {
  return database.transaction(operation);
}
const summaryIncludes = [{ model: clientModel }, { model: technicianModel, required: false }];
const unitIncludes = [
  { model: unitCatalogModel, required: false },
  {
    model: equipmentModel,
    required: false,
    include: [{ model: equipmentCatalogModel, required: false }],
  },
  { model: accessoryModel, required: false, through: { attributes: [] } },
];

const ticketLabels = { ID_cliente:'Cliente', ID_tecnico:'Técnico', Tipo_servicio:'Tipo de servicio', Estatus_servicio:'Estado del servicio', Numero_unidades:'Unidades previstas', Fecha_servicio:'Fecha programada', Fecha_cierre:'Fecha de cierre', Link_maps:'Ubicación', Comentarios:'Comentarios', Estatus_unidades:'Estado de preparación' };
const unitLabels = { ID_Unidad_modelo:'Modelo de unidad', ID_equipo:'Equipo', Placa_unidad:'Placa', Vin_unidad:'VIN' };
export const tickets = {
  async findById(id: number, transaction?: Transaction, lock = false): Promise<Ticket | null> {
    const row = await ticketModel.findByPk(id, options(transaction, lock));
    return row ? mapTicket(row) : null;
  },
  async create(input: Omit<Ticket, 'id'>, transaction: Transaction): Promise<Ticket> {
    const row = await ticketModel.create({ ...mapTicketPatch(input), ID_cliente: input.clientId }, { transaction });
    await recordTicketEvent(row.ID_ticket, 'ticket_creado', changesBetween({}, { ...row.get() }, ticketLabels), transaction);
    return mapTicket(row);
  },
  async update(id: number, patch: Partial<Ticket>, transaction: Transaction): Promise<void> {
    const before = await ticketModel.findByPk(id, options(transaction, true));
    if (!before) return;
    const values = mapTicketPatch(patch);
    const statusChanged = patch.status !== undefined && patch.status !== mapTicket(before).status;
    const closure = statusChanged && patch.status === 'completed' ? literal('UTC_TIMESTAMP(3)') : statusChanged && before.Estatus_servicio === 'Finalizado' ? null : undefined;
    await ticketModel.update({ ...values, ...(closure !== undefined ? { Fecha_cierre: closure } : {}) }, { where: { ID_ticket:id }, transaction });
    const after = (await ticketModel.findByPk(id, { transaction }))!;
    const changes = changesBetween({ ...before.get() }, { ...after.get() }, ticketLabels);
    const event = statusChanged ? patch.status === 'completed' ? 'servicio_finalizado' : before.Estatus_servicio === 'Finalizado' ? 'ticket_reabierto' : 'estado_actualizado' : 'ticket_actualizado';
    await recordTicketEvent(id, event, changes, transaction);
  },
  async findDetails(id: number, transaction: Transaction, technician?: number): Promise<TicketDetails | null> {
    const row = await ticketModel.findOne({
      where: { ID_ticket: id, ...(technician === undefined ? {} : { ID_tecnico: technician }) },
      transaction,
      include: [
        ...summaryIncludes,
        { model: photoModel },
        { model: unitModel, include: unitIncludes },
      ],
    });
    return row ? mapTicketDetails(row) : null;
  },
  async list(status?: TicketStatus, incompleteOnly = false): Promise<TicketSummary[]> {
    const where = {
      ...(status ? { Estatus_servicio: ticketStatusToDatabase[status] } : {}),
      ...(incompleteOnly ? { Estatus_unidades: { [Op.in]: [0, 2] } } : {}),
    };
    return (await ticketModel.findAll({ where, include: summaryIncludes })).map(mapTicketSummary);
  },
};
export const clients = clientRepository;
export const technicians = technicianRepository;
export const units = {
  async findByTicket(ticketId: number, transaction: Transaction): Promise<Unit[]> {
    return (
      await unitModel.findAll({
        where: { ID_ticket: ticketId },
        order: [['ID_unidad', 'ASC']],
        ...options(transaction, true),
      })
    ).map(mapUnit);
  },
  async findById(id: number, transaction: Transaction, lock = false): Promise<Unit | null> {
    const row = await unitModel.findByPk(id, options(transaction, lock));
    return row ? mapUnit(row) : null;
  },
  async findForAssignment(
    ticketId: number,
    ids: number[],
    transaction: Transaction,
  ): Promise<Unit[]> {
    return (
      await unitModel.findAll({
        where: { ID_ticket: ticketId, ID_unidad: { [Op.in]: ids } },
        order: [['ID_unidad', 'ASC']],
        ...options(transaction, true),
      })
    ).map(mapUnit);
  },
  async findByEquipmentId(equipmentId: number, transaction: Transaction): Promise<Unit | null> {
    const row = await unitModel.findOne({ where: { ID_equipo: equipmentId }, transaction });
    return row ? mapUnit(row) : null;
  },
  count(ticketId: number, transaction?: Transaction, equippedOnly = false): Promise<number> {
    return unitModel.count({
      where: { ID_ticket: ticketId, ...(equippedOnly ? { ID_equipo: { [Op.ne]: null } } : {}) },
      transaction,
    });
  },
  async create(input: Omit<Unit, 'id'>, transaction: Transaction): Promise<Unit> {
    const row = await unitModel.create({ ID_Unidad_modelo:input.modelId, ID_ticket:input.ticketId, ID_equipo:input.equipmentId, Placa_unidad:input.licensePlate, Vin_unidad:input.vin }, { transaction });
    await recordTicketEvent(input.ticketId, 'unidad_registrada', [{field:'Unidad',before:null,after:row.ID_unidad}, ...changesBetween({}, { ...row.get() }, unitLabels)], transaction);
    return mapUnit(row);
  },
  async setEquipment(
    id: number,
    equipmentId: number | null,
    transaction: Transaction,
  ): Promise<void> {
    const unit = await unitModel.findByPk(id, { transaction });
    if (!unit || unit.ID_equipo === equipmentId) return;
    await unitModel.update({ ID_equipo: equipmentId }, { where: { ID_unidad: id }, transaction });
    await recordTicketEvent(unit.ID_ticket, equipmentId === null ? 'equipo_retirado' : 'equipo_asignado', [{field:'Unidad',before:id,after:id},{field:'Equipo',before:unit.ID_equipo,after:equipmentId}], transaction);
  },
  async remove(id: number, transaction: Transaction): Promise<void> {
    const unit = await unitModel.findByPk(id, { transaction });
    const linked = await unitAccessoryModel.findAll({ where: { ID_unidad:id }, transaction, order:[['ID_accesorio','ASC']] });
    await unitAccessoryModel.destroy({ where: { ID_unidad: id }, transaction });
    if (unit) await recordTicketEvent(unit.ID_ticket, 'unidad_retirada', [{field:'Unidad',before:id,after:null}, ...changesBetween({ ...unit.get() }, {}, unitLabels), ...(linked.length ? [{field:'Accesorios',before:linked.map(row=>row.ID_accesorio),after:null}] : [])], transaction);
    await unitModel.destroy({ where: { ID_unidad: id }, transaction });
  },
  async listDetails(ticketId: number): Promise<UnitDetails[]> {
    return (
      await unitModel.findAll({
        where: { ID_ticket: ticketId },
        include: [...unitIncludes, { model: ticketModel }],
      })
    ).map(mapUnitDetails);
  },
};
export const equipment = {
  async update(id: number, modelId: number, imei: string | null, modemId: string | null, transaction: Transaction): Promise<void> {
    await equipmentModel.update(
      { ID_equipo_modelo: modelId, IMEI: imei, ID_modem: modemId },
      { where: { ID_equipo: id }, transaction },
    );
  },
  async remove(id: number, transaction: Transaction): Promise<void> {
    await equipmentModel.destroy({ where: { ID_equipo: id }, transaction });
  },
  async create(modelId: number, imei: string | null, modemId: string | null, transaction?: Transaction): Promise<Equipment> {
    return mapEquipment(
      await equipmentModel.create({ ID_equipo_modelo: modelId, IMEI: imei, ID_modem: modemId }, { transaction }),
    );
  },
  async findById(id: number, transaction: Transaction): Promise<Equipment | null> {
    const row = await equipmentModel.findByPk(id, options(transaction, true));
    return row ? mapEquipment(row) : null;
  },
  async findForAssignment(ids: number[], transaction: Transaction): Promise<Equipment[]> {
    return (
      await equipmentModel.findAll({
        where: { ID_equipo: { [Op.in]: ids } },
        order: [['ID_equipo', 'ASC']],
        ...options(transaction, true),
      })
    ).map(mapEquipment);
  },
  async setStatus(id: number, status: EquipmentStatus, transaction: Transaction): Promise<void> {
    await equipmentModel.update(
      { Estatus_equipo: equipmentStatusToDatabase[status] },
      { where: { ID_equipo: id }, transaction },
    );
  },
  async list(status?: EquipmentStatus): Promise<Equipment[]> {
    return (
      await equipmentModel.findAll({
        where: status ? { Estatus_equipo: equipmentStatusToDatabase[status] } : {},
        include: [{ model: equipmentCatalogModel }],
      })
    ).map(mapEquipment);
  },
};
export const catalogs = {
  listAccessories: accessoryCatalogRepository.list,
  listEquipmentModels: equipmentCatalogRepository.list,
  listUnitModels: unitCatalogRepository.list,
  findEquipmentModel: equipmentCatalogRepository.findById,
  async findUnitModel(id: number, transaction: Transaction) {
    const row = await unitCatalogModel.findByPk(id, { transaction });
    return row ? mapUnitModel(row) : null;
  },
  async findAccessory(id: number, transaction: Transaction) {
    const row = await accessoryModel.findByPk(id, { transaction });
    return row ? mapAccessory(row) : null;
  },
};
export const accessories = {
  async link(unitId: number, accessoryId: number, transaction: Transaction): Promise<void> {
    const [, created] = await unitAccessoryModel.findOrCreate({
      where: { ID_unidad: unitId, ID_accesorio: accessoryId },
      transaction,
    });
    const unit = await unitModel.findByPk(unitId, { transaction });
    if (created && unit) await recordTicketEvent(unit.ID_ticket, 'accesorio_asignado', [{field:'Unidad',before:unitId,after:unitId},{field:'Accesorio',before:null,after:accessoryId}], transaction);
  },
  async unlink(unitId: number, accessoryId: number, transaction: Transaction): Promise<number> {
    const removed = await unitAccessoryModel.destroy({ where:{ ID_unidad:unitId, ID_accesorio:accessoryId }, transaction });
    const unit = await unitModel.findByPk(unitId, { transaction });
    if (removed && unit) await recordTicketEvent(unit.ID_ticket, 'accesorio_retirado', [{field:'Unidad',before:unitId,after:unitId},{field:'Accesorio',before:accessoryId,after:null}], transaction);
    return removed;
  },
};
export const photos = {
  async create(ticketId: number, fileUrl: string, originalName: string, transaction: Transaction) {
    const row = await photoModel.create({ ID_ticket:ticketId, Ruta_archivo:fileUrl, Nombre_original:originalName }, { transaction });
    await recordTicketEvent(ticketId, 'evidencia_agregada', [{field:'Evidencia',before:null,after:originalName || fileUrl},{field:'Foto',before:null,after:row.ID_foto}], transaction);
    return mapPhoto(row);
  },
};
