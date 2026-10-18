import { BusinessError, isRecord } from '../domain/business-error';
import type {
  Accessory,
  Client,
  CreateEquipmentInput,
  CreateTicketInput,
  Equipment,
  EquipmentModel,
  Technician,
  Ticket,
  TicketDetails,
  TicketPhoto,
  TicketSummary,
  Unit,
  UnitDetails,
  UnitModel,
} from '../domain/entities';
import {
  equipmentStatusToDatabase,
  readLegacyServiceType,
  serviceTypeToDatabase,
  ticketStatusToDatabase,
} from '../infrastructure/database/mapping';

function body(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new BusinessError(400, 'Datos de solicitud inválidos');
  return value;
}
export function readCreateTicketRequest(value: unknown): CreateTicketInput {
  const input = body(value);
  return {
    clientId: input.ID_cliente,
    technicianId: input.ID_Tecnico,
    serviceType: readLegacyServiceType(input.Tipo_servicio),
    unitCount: input.numero_unidades,
    scheduledAt: input.fecha_registro,
    locationUrl: input.direccion_servicio === 'Pendiente' ? null : input.direccion_servicio,
    comments: input.comentarios,
  };
}
export function readCreateEquipmentRequest(value: unknown): CreateEquipmentInput {
  const input = body(value);
  return { modelId: input.id_equipo_modelo, imei: input.imei, modemId: input.id_modem };
}
export function readUnitRegistration(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((entry: unknown) => {
    const input = body(entry);
    return {
      ticketId: input.ticketId,
      modelId: input.modelo,
      licensePlate: input.placa,
      vin: input.vin,
    };
  });
}
export function readEquipmentAssignment(value: unknown): unknown {
  const input = body(value);
  return { equipment: input.equipos, accessories: input.accesorios };
}
export const serializeClient = (client: Client) => ({
  ID_cliente: client.id,
  Nombre_empresa: client.companyName,
  Encargado: client.contactName,
  Numero: client.phone,
});
export const serializeTechnician = (technician: Technician) => ({
  ID_Tecnico: technician.id,
  Nombre_tecnico: technician.name,
  Estatus_tecnico: technician.status === 'active' ? 'Activo' : 'Inactivo',
  Numero_tecnico: technician.phone,
});
export const serializeEquipmentModel = (model: EquipmentModel) => ({
  ID_equipo_modelo: model.id,
  Marca_equipo: model.brand,
  Modelo_equipo: model.model,
});
export const serializeUnitModel = (model: UnitModel) => ({
  ID_Unidad_modelo: model.id,
  Marca_unidad: model.brand,
  Modelo_Unidad: model.model,
  Modelo_unidad: model.model,
});
export const serializeAccessory = (accessory: Accessory) => ({
  ID_accesorio_modelo: accessory.id,
  Nombre_accesorio: accessory.name,
});
export const serializeEquipment = (device: Equipment) => ({
  ID_equipo: device.id,
  ID_equipo_modelo: device.modelId,
  IMEI: device.imei,
  ID_modem: device.modemId,
  Estatus_equipo: equipmentStatusToDatabase[device.status],
  ...(device.model ? { Equipo_stock: serializeEquipmentModel(device.model) } : {}),
});
export const serializeUnit = (unit: Unit) => ({
  ID_unidad: unit.id,
  ID_Unidad: unit.id,
  ID_Unidad_modelo: unit.modelId,
  ID_ticket: unit.ticketId,
  ID_equipo: unit.equipmentId,
  Placa_unidad: unit.licensePlate,
  Vin_unidad: unit.vin,
});
export const serializeUnitDetails = (unit: UnitDetails) => ({
  ...serializeUnit(unit),
  Unidad_stock: unit.model ? serializeUnitModel(unit.model) : null,
  Equipo: unit.equipment ? serializeEquipment(unit.equipment) : null,
  Accesorio_stocks: unit.accessories.map(serializeAccessory),
  ...(unit.ticket ? { Ticket: serializeTicket(unit.ticket) } : {}),
});
export const serializePhoto = (photo: TicketPhoto) => ({
  ID_foto: photo.id,
  ID_ticket: photo.ticketId,
  Ruta_archivo: photo.fileUrl,
  Nombre_original: photo.originalName,
  createdAt: photo.createdAt,
  updatedAt: photo.updatedAt,
});
export const serializeTicket = (ticket: Ticket) => ({
  ID_ticket: ticket.id,
  ID_cliente: ticket.clientId,
  ID_tecnico: ticket.technicianId,
  Tipo_servicio: ticket.serviceType ? serviceTypeToDatabase[ticket.serviceType] : null,
  Estatus_servicio: ticket.status ? ticketStatusToDatabase[ticket.status] : null,
  Numero_unidades: ticket.unitCount,
  Fecha_servicio: ticket.scheduledAt,
  Link_maps: ticket.locationUrl,
  Comentarios: ticket.comments,
  Estatus_unidades: ticket.assignmentStatus,
});
export const serializeTicketSummary = (ticket: TicketSummary) => ({
  ...serializeTicket(ticket),
  Cliente: ticket.client ? serializeClient(ticket.client) : null,
  Tecnico: ticket.technician ? serializeTechnician(ticket.technician) : null,
});
export const serializeTicketDetails = (ticket: TicketDetails) => ({
  ...serializeTicketSummary(ticket),
  Unidades: ticket.units.map(serializeUnitDetails),
  TicketFotos: ticket.photos.map(serializePhoto),
});
