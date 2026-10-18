import {
  accessoryCatalogRepository,
  clientRepository,
  equipmentCatalogRepository,
  technicianRepository,
  unitCatalogRepository,
} from './master-data-repository';
import { Op, type Transaction } from 'sequelize';
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

export const tickets = {
  async findById(id: number, transaction?: Transaction, lock = false): Promise<Ticket | null> {
    const row = await ticketModel.findByPk(id, options(transaction, lock));
    return row ? mapTicket(row) : null;
  },
  async create(input: Omit<Ticket, 'id'>, transaction: Transaction): Promise<Ticket> {
    return mapTicket(
      await ticketModel.create(
        { ...mapTicketPatch(input), ID_cliente: input.clientId },
        { transaction },
      ),
    );
  },
  async update(id: number, patch: Partial<Ticket>, transaction: Transaction): Promise<void> {
    await ticketModel.update(mapTicketPatch(patch), { where: { ID_ticket: id }, transaction });
  },
  async findDetails(id: number): Promise<TicketDetails | null> {
    const row = await ticketModel.findByPk(id, {
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
    return mapUnit(
      await unitModel.create(
        {
          ID_Unidad_modelo: input.modelId,
          ID_ticket: input.ticketId,
          ID_equipo: input.equipmentId,
          Placa_unidad: input.licensePlate,
          Vin_unidad: input.vin,
        },
        { transaction },
      ),
    );
  },
  async setEquipment(
    id: number,
    equipmentId: number | null,
    transaction: Transaction,
  ): Promise<void> {
    await unitModel.update({ ID_equipo: equipmentId }, { where: { ID_unidad: id }, transaction });
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
  async create(modelId: number, imei: string | null, modemId: string | null): Promise<Equipment> {
    return mapEquipment(
      await equipmentModel.create({ ID_equipo_modelo: modelId, IMEI: imei, ID_modem: modemId }),
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
    await unitAccessoryModel.findOrCreate({
      where: { ID_unidad: unitId, ID_accesorio: accessoryId },
      transaction,
    });
  },
  unlink(unitId: number, accessoryId: number, transaction: Transaction): Promise<number> {
    return unitAccessoryModel.destroy({
      where: { ID_unidad: unitId, ID_accesorio: accessoryId },
      transaction,
    });
  },
};
export const photos = {
  async create(ticketId: number, fileUrl: string, originalName: string, transaction: Transaction) {
    return mapPhoto(
      await photoModel.create(
        { ID_ticket: ticketId, Ruta_archivo: fileUrl, Nombre_original: originalName },
        { transaction },
      ),
    );
  },
};
