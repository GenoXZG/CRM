import { Op, type Attributes, type Model, type ModelStatic, type WhereOptions } from 'sequelize';
import { equipmentCatalogModel, unitCatalogModel, accessoryModel } from './models';
import { mapEquipmentModel, mapUnitModel, mapAccessory } from './mapping';

export interface CatalogQuery { search: string; page: number; size: number }
async function page<Row extends Model, Entity>(
  model: ModelStatic<Row>, fields: string[], map: (row: Row) => Entity, query: CatalogQuery,
) {
  // Escape LIKE metacharacters so searches treat user input as literal text.
  const search = query.search.replace(/[\\%_]/g, '\\$&');
  const where = (search ? { [Op.or]: fields.map(field => ({ [field]: { [Op.like]: `%${search}%` } })) } : {}) as WhereOptions<Attributes<Row>>;
  const count = await model.count({ where });
  const pages = Math.max(1, Math.ceil(count / query.size));
  const current = Math.min(query.page, pages);
  const rows = await model.findAll({ where, limit: query.size, offset: (current - 1) * query.size, order: [[model.primaryKeyAttribute, 'DESC']] });
  return { rows: rows.map(map), count, pages, page: current, size: query.size, search: query.search };
}
export const equipmentPage = (query: CatalogQuery) => page(equipmentCatalogModel, ['Marca_equipo', 'Modelo_equipo'], mapEquipmentModel, query);
export const unitPage = (query: CatalogQuery) => page(unitCatalogModel, ['Marca_unidad', 'Modelo_Unidad'], mapUnitModel, query);
export const accessoryPage = (query: CatalogQuery) => page(accessoryModel, ['Nombre_accesorio'], mapAccessory, query);
