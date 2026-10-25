import type { Request, Response } from 'express';
import { respondError } from '../adapters/http-errors';
import { serializeAccessory, serializeEquipment, serializeTicketSummary } from '../adapters/legacy-http';
import { catalogs } from '../infrastructure/database/repositories';
import { getEquipmentAssignmentTickets } from '../services/ticket-service';
import { getAvailableEquipment } from '../services/equipment-service';

export async function renderAssignments(_request: Request, response: Response) {
  try {
    const [tickets, equipment, accessories] = await Promise.all([
      getEquipmentAssignmentTickets(), getAvailableEquipment(), catalogs.listAccessories(),
    ]);
    response.render('asignacion_unidades', {
      assignmentTickets: tickets.map(serializeTicketSummary),
      equiposEnEspera: equipment.map(serializeEquipment),
      accesoriosDisponibles: accessories.map(serializeAccessory),
    });
  } catch (error) { respondError(response, error); }
}
