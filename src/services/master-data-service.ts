import type { Accessory, Client, EquipmentModel, Technician, UnitModel } from '../domain/entities';
import { BusinessError, isRecord, positiveInteger } from '../domain/business-error';
import {
  accessoryCatalogRepository,
  clientRepository,
  equipmentCatalogRepository,
  technicianRepository,
  unitCatalogRepository,
  listUnitBrands,
  listUnitModelsByBrand,
  type MasterDataRepository,
} from '../infrastructure/database/master-data-repository';
import { withTransaction } from '../infrastructure/database/repositories';

export function requiredText(value: unknown, field: string, maximum = 255): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum) {
    throw new BusinessError(
      400,
      `${field} es obligatorio y debe tener como máximo ${maximum} caracteres`,
    );
  }
  return value.trim();
}
function inputRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new BusinessError(400, 'Datos de solicitud inválidos');
  return value;
}
function phone(value: unknown): string {
  const text = requiredText(value, 'Teléfono', 30);
  const digits = text.replace(/[\s().-]/g, '');
  if (!/^\d{10}$/.test(digits))
    throw new BusinessError(400, 'El teléfono debe contener 10 dígitos');
  return digits;
}
// Los técnicos y los clientes requieren 10 dígitos.
function technicianPhone(value: unknown): string {
  const text = requiredText(value, 'Teléfono del técnico', 30);
  if (!/^[0-9]{10}$/.test(text)) {
    throw new BusinessError(400, 'El teléfono del técnico debe contener exactamente 10 dígitos numéricos');
  }
  return text;
}
function service<Entity extends { id: number }>(
  repository: MasterDataRepository<Entity>,
  validate: (value: unknown) => Omit<Entity, 'id'>,
  label: string,
) {
  return {
    list: () => repository.list(),
    async create(value: unknown) {
      const input = validate(value);
      return withTransaction((transaction) => repository.create(input, transaction));
    },
    async update(identifier: unknown, value: unknown) {
      const id = positiveInteger(identifier, 'Identificador');
      const input = validate(value);
      await withTransaction(async (transaction) => {
        if (!(await repository.findById(id, transaction)))
          throw new BusinessError(404, `${label} no encontrado`);
        await repository.update(id, input, transaction);
      });
    },
    async remove(identifier: unknown) {
      const id = positiveInteger(identifier, 'Identificador');
      await withTransaction(async (transaction) => {
        if (!(await repository.findById(id, transaction)))
          throw new BusinessError(404, `${label} no encontrado`);
        if (await repository.referenceCount(id, transaction)) {
          throw new BusinessError(409, 'No se puede eliminar un registro con información asociada');
        }
        await repository.remove(id, transaction);
      });
    },
  };
}
export const clientService = service(
  clientRepository,
  (value): Omit<Client, 'id'> => {
    const input = inputRecord(value);
    return {
      companyName: requiredText(input.companyName, 'Empresa', 100),
      contactName: requiredText(input.contactName, 'Encargado', 50),
      phone: phone(input.phone),
    };
  },
  'Cliente',
);
export const technicianService = service(
  technicianRepository,
  (value): Omit<Technician, 'id'> => {
    const input = inputRecord(value);
    if (input.status !== 'active' && input.status !== 'inactive')
      throw new BusinessError(400, 'Estatus de técnico inválido');
    return {
      name: requiredText(input.name, 'Nombre'),
      phone: technicianPhone(input.phone),
      status: input.status,
    };
  },
  'Técnico',
);
function catalogInput(value: unknown): Omit<UnitModel, 'id'> {
  const input = inputRecord(value);
  return { brand: requiredText(input.brand, 'Marca'), model: requiredText(input.model, 'Modelo') };
}
export const equipmentCatalogService = service<EquipmentModel>(
  equipmentCatalogRepository,
  catalogInput,
  'Modelo de equipo',
);
export const unitCatalogService = service<UnitModel>(
  unitCatalogRepository,
  catalogInput,
  'Modelo de unidad',
);
export const accessoryCatalogService = service(
  accessoryCatalogRepository,
  (value): Omit<Accessory, 'id'> => ({ name: requiredText(inputRecord(value).name, 'Nombre') }),
  'Accesorio',
);
export const getUnitBrands = () => listUnitBrands();
export const getUnitModelsByBrand = (brand: unknown) =>
  listUnitModelsByBrand(requiredText(brand, 'Marca'));
