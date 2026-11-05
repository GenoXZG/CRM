import { BusinessError, isRecord } from '../domain/business-error';

export function requestBody(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new BusinessError(400, 'Datos de solicitud inválidos');
  return value;
}
export const readClient = (input: Record<string, unknown>) => ({
  companyName: input.Nombre_empresa,
  contactName: input.Encargado,
  phone: input.Numero,
});
export const readTechnician = (input: Record<string, unknown>) => ({
  name: input.Nombre_tecnico,
  phone: input.Numero_tecnico,
  status:
    input.Estatus_tecnico === 'Activo'
      ? 'active'
      : input.Estatus_tecnico === 'Inactivo'
        ? 'inactive'
        : input.Estatus_tecnico,
});
export const readEquipmentModel = (input: Record<string, unknown>) => ({
  brand: input.Marca_equipo,
  model: input.Modelo_equipo,
});
export const readUnitModel = (input: Record<string, unknown>) => ({
  brand: input.Marca_unidad,
  model: input.Modelo_Unidad,
});
export const readAccessory = (input: Record<string, unknown>) => ({ name: input.Nombre_accesorio });
