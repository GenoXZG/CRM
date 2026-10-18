import {
  col,
  fn,
  type Attributes,
  type CreationAttributes,
  type Model,
  type ModelStatic,
  type Transaction,
  type WhereOptions,
} from 'sequelize';
import type {
  Accessory,
  Client,
  EquipmentModel,
  Technician,
  UnitModel,
} from '../../domain/entities';
import {
  accessoryModel,
  clientModel,
  equipmentCatalogModel,
  equipmentModel,
  technicianModel,
  ticketModel,
  unitAccessoryModel,
  unitCatalogModel,
  unitModel,
} from './models';
import { mapAccessory, mapClient, mapEquipmentModel, mapTechnician, mapUnitModel } from './mapping';

export interface MasterDataRepository<Entity extends { id: number }> {
  list(): Promise<Entity[]>;
  findById(id: number, transaction: Transaction): Promise<Entity | null>;
  create(input: Omit<Entity, 'id'>, transaction: Transaction): Promise<Entity>;
  update(id: number, input: Omit<Entity, 'id'>, transaction: Transaction): Promise<void>;
  remove(id: number, transaction: Transaction): Promise<void>;
  referenceCount(id: number, transaction: Transaction): Promise<number>;
}

function repository<Row extends Model, Entity extends { id: number }>(
  model: ModelStatic<Row>,
  map: (row: Row) => Entity,
  where: (id: number) => WhereOptions<Attributes<Row>>,
  attributes: (input: Omit<Entity, 'id'>) => CreationAttributes<Row> & Partial<Attributes<Row>>,
  referenceCount: MasterDataRepository<Entity>['referenceCount'],
): MasterDataRepository<Entity> {
  return {
    async list() {
      return (await model.findAll()).map(map);
    },
    async findById(id, transaction) {
      const row = await model.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      return row ? map(row) : null;
    },
    async create(input, transaction) {
      return map(await model.create(attributes(input), { transaction }));
    },
    async update(id, input, transaction) {
      await model.update(attributes(input), { where: where(id), transaction });
    },
    async remove(id, transaction) {
      await model.destroy({ where: where(id), transaction });
    },
    referenceCount,
  };
}

export const clientRepository = repository(
  clientModel,
  mapClient,
  (id) => ({ ID_cliente: id }),
  (input: Omit<Client, 'id'>) => ({
    Nombre_empresa: input.companyName,
    Encargado: input.contactName,
    Numero: input.phone,
  }),
  (id, transaction) => ticketModel.count({ where: { ID_cliente: id }, transaction }),
);
export const technicianRepository = repository(
  technicianModel,
  mapTechnician,
  (id) => ({ ID_Tecnico: id }),
  (input: Omit<Technician, 'id'>) => ({
    Nombre_tecnico: input.name,
    Numero_tecnico: input.phone,
    Estatus_tecnico: input.status === 'active' ? ('Activo' as const) : ('Inactivo' as const),
  }),
  (id, transaction) => ticketModel.count({ where: { ID_tecnico: id }, transaction }),
);
export const equipmentCatalogRepository = repository(
  equipmentCatalogModel,
  mapEquipmentModel,
  (id) => ({ ID_equipo_modelo: id }),
  (input: Omit<EquipmentModel, 'id'>) => ({
    Marca_equipo: input.brand,
    Modelo_equipo: input.model,
  }),
  (id, transaction) => equipmentModel.count({ where: { ID_equipo_modelo: id }, transaction }),
);
export const unitCatalogRepository = repository(
  unitCatalogModel,
  mapUnitModel,
  (id) => ({ ID_Unidad_modelo: id }),
  (input: Omit<UnitModel, 'id'>) => ({ Marca_unidad: input.brand, Modelo_Unidad: input.model }),
  (id, transaction) => unitModel.count({ where: { ID_Unidad_modelo: id }, transaction }),
);
export const accessoryCatalogRepository = repository(
  accessoryModel,
  mapAccessory,
  (id) => ({ ID_accesorio_modelo: id }),
  (input: Omit<Accessory, 'id'>) => ({ Nombre_accesorio: input.name }),
  (id, transaction) => unitAccessoryModel.count({ where: { ID_accesorio: id }, transaction }),
);

export async function listUnitBrands(): Promise<string[]> {
  return (
    await unitCatalogModel.findAll({
      attributes: [[fn('DISTINCT', col('Marca_unidad')), 'Marca_unidad']],
      order: [['Marca_unidad', 'ASC']],
    })
  ).map((row) => row.Marca_unidad);
}
export async function listUnitModelsByBrand(brand: string): Promise<UnitModel[]> {
  return (
    await unitCatalogModel.findAll({
      where: { Marca_unidad: brand },
      order: [['Modelo_Unidad', 'ASC']],
    })
  ).map(mapUnitModel);
}
