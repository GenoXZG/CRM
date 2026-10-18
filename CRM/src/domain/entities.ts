export type TicketStatus = 'waiting' | 'in_progress' | 'completed';
export type ServiceType = 'installation' | 'removal' | 'inspection' | 'recovery';
export type EquipmentStatus = 'pending_assignment' | 'assigned' | 'installed';
export type TechnicianStatus = 'active' | 'inactive';
export enum AssignmentStatus {
  Pending = 0,
  Complete = 1,
  Partial = 2,
}

export interface Client {
  id: number;
  companyName: string;
  contactName: string;
  phone: string;
}
export interface Technician {
  id: number;
  name: string;
  status: TechnicianStatus;
  phone: string;
}
export interface EquipmentModel {
  id: number;
  brand: string;
  model: string;
}
export interface UnitModel {
  id: number;
  brand: string;
  model: string;
}
export interface Accessory {
  id: number;
  name: string;
}
export interface Equipment {
  id: number;
  modelId: number;
  imei: string | null;
  modemId: string | null;
  status: EquipmentStatus;
  model?: EquipmentModel;
}
export interface Unit {
  id: number;
  modelId: number;
  equipmentId: number | null;
  ticketId: number;
  licensePlate: string | null;
  vin: string | null;
}
export interface Ticket {
  id: number;
  clientId: number;
  technicianId: number | null;
  serviceType: ServiceType | null;
  status: TicketStatus | null;
  unitCount: number | null;
  scheduledAt: Date | null;
  locationUrl: string | null;
  comments: string | null;
  assignmentStatus: AssignmentStatus;
}
export interface TicketPhoto {
  id: number;
  ticketId: number | null;
  fileUrl: string;
  originalName: string | null;
  createdAt: Date;
  updatedAt: Date;
}
export interface UnitDetails extends Unit {
  model: UnitModel | null;
  equipment: Equipment | null;
  accessories: Accessory[];
  ticket?: Ticket;
}
export interface TicketSummary extends Ticket {
  client: Client | null;
  technician: Technician | null;
}
export interface TicketDetails extends TicketSummary {
  units: UnitDetails[];
  photos: TicketPhoto[];
}
export interface AssignmentSummary {
  total: number;
  equipped: number;
  complete: boolean;
  status: AssignmentStatus;
}
export interface CreateTicketInput {
  clientId: unknown;
  technicianId?: unknown;
  serviceType: unknown;
  unitCount: unknown;
  scheduledAt?: unknown;
  locationUrl?: unknown;
  comments?: unknown;
}
export interface CreateEquipmentInput {
  modelId: unknown;
  imei?: unknown;
  modemId?: unknown;
}
export interface UploadedPhoto {
  filename: string;
  originalname: string;
}
export interface DashboardMetrics {
  totalTickets: number;
  counts: Record<TicketStatus, number>;
  technicianWorkload: { technicianId: number | null; name: string | null; activeTickets: number }[];
  equipmentAvailability: { modelId: number; model: string; available: number }[];
}
