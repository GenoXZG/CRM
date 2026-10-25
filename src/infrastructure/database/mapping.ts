import type {
  Accessory,
  Client,
  Equipment,
  EquipmentModel,
  EquipmentStatus,
  ServiceType,
  Technician,
  Ticket,
  TicketDetails,
  TicketPhoto,
  TicketStatus,
  TicketSummary,
  Unit,
  UnitDetails,
  UnitModel,
} from '../../domain/entities';
import type {
  AccessoryRow,
  ClientRow,
  DatabaseEquipmentStatus,
  DatabaseServiceType,
  DatabaseTicketStatus,
  EquipmentModelRow,
  EquipmentRow,
  PhotoRow,
  TechnicianRow,
  TicketAttributes,
  TicketRow,
  UnitModelRow,
  UnitRow,
} from './models';

export const ticketStatusToDatabase: Record<TicketStatus, DatabaseTicketStatus> = {
  waiting: 'En espera',
  in_progress: 'En seguimiento',
  completed: 'Finalizado',
};
export const ticketStatusFromDatabase: Record<DatabaseTicketStatus, TicketStatus> = {
  'En espera': 'waiting',
  'En seguimiento': 'in_progress',
  Finalizado: 'completed',
};
export const serviceTypeToDatabase: Record<ServiceType, DatabaseServiceType> = {
  installation: 'Instalacion',
  removal: 'Desinstalacion',
  inspection: 'Revision',
  recovery: 'Rescate',
};
const serviceTypeFromDatabase: Record<DatabaseServiceType, ServiceType> = {
  Instalacion: 'installation',
  Desinstalacion: 'removal',
  Revision: 'inspection',
  Rescate: 'recovery',
};
export const equipmentStatusToDatabase: Record<EquipmentStatus, DatabaseEquipmentStatus> = {
  pending_assignment: 'En espera',
  assigned: 'Asignado',
  installed: 'Instalado',
};
const equipmentStatusFromDatabase: Record<DatabaseEquipmentStatus, EquipmentStatus> = {
  'En espera': 'pending_assignment',
  Asignado: 'assigned',
  Instalado: 'installed',
};
export function readLegacyServiceType(value: unknown): unknown {
  if (typeof value === 'string' && Object.hasOwn(serviceTypeFromDatabase, value)) {
    return serviceTypeFromDatabase[value as DatabaseServiceType];
  }
  return value;
}
export const mapClient = (row: ClientRow): Client => ({
  id: row.ID_cliente,
  companyName: row.Nombre_empresa,
  contactName: row.Encargado,
  phone: row.Numero,
});
export const mapTechnician = (row: TechnicianRow): Technician => ({
  id: row.ID_Tecnico,
  name: row.Nombre_tecnico,
  status: row.Estatus_tecnico === 'Activo' ? 'active' : 'inactive',
  phone: row.Numero_tecnico,
});
export const mapEquipmentModel = (row: EquipmentModelRow): EquipmentModel => ({
  id: row.ID_equipo_modelo,
  brand: row.Marca_equipo,
  model: row.Modelo_equipo,
});
export const mapUnitModel = (row: UnitModelRow): UnitModel => ({
  id: row.ID_Unidad_modelo,
  brand: row.Marca_unidad,
  model: row.Modelo_Unidad,
});
export const mapAccessory = (row: AccessoryRow): Accessory => ({
  id: row.ID_accesorio_modelo,
  name: row.Nombre_accesorio,
});
export const mapEquipment = (row: EquipmentRow): Equipment => ({
  id: row.ID_equipo,
  modelId: row.ID_equipo_modelo,
  imei: row.IMEI,
  modemId: row.ID_modem,
  status: equipmentStatusFromDatabase[row.Estatus_equipo],
  ...(row.Equipo_stock ? { model: mapEquipmentModel(row.Equipo_stock) } : {}),
});
export const mapUnit = (row: UnitRow): Unit => ({
  id: row.ID_unidad,
  modelId: row.ID_Unidad_modelo,
  equipmentId: row.ID_equipo,
  ticketId: row.ID_ticket,
  licensePlate: row.Placa_unidad,
  vin: row.Vin_unidad,
});
export const mapPhoto = (row: PhotoRow): TicketPhoto => ({
  id: row.ID_foto,
  ticketId: row.ID_ticket,
  fileUrl: row.Ruta_archivo,
  originalName: row.Nombre_original,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});
export const mapTicket = (row: TicketRow): Ticket => ({
  id: row.ID_ticket,
  clientId: row.ID_cliente,
  technicianId: row.ID_tecnico,
  serviceType: row.Tipo_servicio ? serviceTypeFromDatabase[row.Tipo_servicio] : null,
  status: row.Estatus_servicio ? ticketStatusFromDatabase[row.Estatus_servicio] : null,
  unitCount: row.Numero_unidades,
  scheduledAt: row.Fecha_servicio,
  locationUrl: row.Link_maps,
  comments: row.Comentarios,
  assignmentStatus: row.Estatus_unidades ?? 0,
});
export const mapUnitDetails = (row: UnitRow): UnitDetails => ({
  ...mapUnit(row),
  model: row.Unidad_stock ? mapUnitModel(row.Unidad_stock) : null,
  equipment: row.Equipo ? mapEquipment(row.Equipo) : null,
  accessories: (row.Accesorio_stocks || []).map(mapAccessory),
  ...(row.Ticket ? { ticket: mapTicket(row.Ticket) } : {}),
});
export const mapTicketSummary = (row: TicketRow): TicketSummary => ({
  ...mapTicket(row),
  client: row.Cliente ? mapClient(row.Cliente) : null,
  technician: row.Tecnico ? mapTechnician(row.Tecnico) : null,
});
export const mapTicketDetails = (row: TicketRow): TicketDetails => ({
  ...mapTicketSummary(row),
  units: (row.Unidades || []).map(mapUnitDetails),
  photos: (row.TicketFotos || []).map(mapPhoto),
});
export function mapTicketPatch(patch: Partial<Ticket>): Partial<TicketAttributes> {
  const result: Partial<TicketAttributes> = {};
  if (patch.clientId !== undefined) result.ID_cliente = patch.clientId;
  if (patch.technicianId !== undefined) result.ID_tecnico = patch.technicianId;
  if (patch.serviceType !== undefined)
    result.Tipo_servicio = patch.serviceType ? serviceTypeToDatabase[patch.serviceType] : null;
  if (patch.status !== undefined)
    result.Estatus_servicio = patch.status ? ticketStatusToDatabase[patch.status] : null;
  if (patch.unitCount !== undefined) result.Numero_unidades = patch.unitCount;
  if (patch.scheduledAt !== undefined) result.Fecha_servicio = patch.scheduledAt;
  if (patch.locationUrl !== undefined) result.Link_maps = patch.locationUrl;
  if (patch.comments !== undefined) result.Comentarios = patch.comments;
  if (patch.assignmentStatus !== undefined) result.Estatus_unidades = patch.assignmentStatus;
  return result;
}
