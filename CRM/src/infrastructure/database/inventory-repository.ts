import { Op, type WhereOptions } from 'sequelize';
import type { EquipmentStatus } from '../../domain/entities';
import { equipmentModel, equipmentCatalogModel, unitModel, type EquipmentAttributes } from './models';
import { equipmentStatusToDatabase, mapEquipment } from './mapping';

export interface InventorySearch {
  search: string;
  status: EquipmentStatus | '';
  brand: string;
  model: number | null;
  page: number;
  size: number;
}
export async function searchInventory(query: InventorySearch) {
  const conditions: WhereOptions<EquipmentAttributes>[] = [];
  if (query.status) conditions.push({ Estatus_equipo: equipmentStatusToDatabase[query.status] });
  if (query.brand) conditions.push({ '$Equipo_stock.Marca_equipo$': query.brand });
  if (query.model) conditions.push({ ID_equipo_modelo: query.model });
  if (query.search) {
    const term = `%${query.search.replace(/[\\%_]/g, '\\$&')}%`;
    const id = Number(query.search.replace(/^#/, ''));
    conditions.push({ [Op.or]: [
      { IMEI: { [Op.like]: term } }, { ID_modem: { [Op.like]: term } },
      { '$Equipo_stock.Marca_equipo$': { [Op.like]: term } },
      { '$Equipo_stock.Modelo_equipo$': { [Op.like]: term } },
      ...(Number.isInteger(id) && id > 0 && id <= 2147483647 ? [{ ID_equipo: id }] : []),
    ] });
  }
  const where: WhereOptions<EquipmentAttributes> = { [Op.and]: conditions };
  const include = [{ model: equipmentCatalogModel }];
  const count = await equipmentModel.count({ where, include });
  const pages = Math.max(1, Math.ceil(count / query.size));
  const page = Math.min(query.page, pages);
  const rows = await equipmentModel.findAll({ where, include, order: [['ID_equipo', 'DESC']], limit: query.size, offset: (page - 1) * query.size });
  const assignments = rows.length ? await unitModel.findAll({ where: { ID_equipo: { [Op.in]: rows.map(row => row.ID_equipo) } } }) : [];
  const byDevice = new Map(assignments.map(unit => [unit.ID_equipo, { ticketId: unit.ID_ticket, unitId: unit.ID_unidad, licensePlate: unit.Placa_unidad }]));
  return { equipment: rows.map(row => ({ ...mapEquipment(row), assignment: byDevice.get(row.ID_equipo) ?? null })), count, pages, page, size: query.size };
}
export async function getInventoryTotals() {
  const [available, assigned, installed] = await Promise.all([
    equipmentModel.count({ where: { Estatus_equipo: 'En espera' } }),
    equipmentModel.count({ where: { Estatus_equipo: 'Asignado' } }),
    equipmentModel.count({ where: { Estatus_equipo: 'Instalado' } }),
  ]);
  return { available, assigned, installed, total: available + assigned + installed };
}
