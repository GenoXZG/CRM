import type { Request, Response } from 'express';
import { respondError } from '../adapters/http-errors';
import {
  readCreateEquipmentRequest,
  readEquipmentAssignment,
  serializeAccessory,
  serializeEquipment,
  serializeEquipmentModel,
  serializeTicketSummary,
} from '../adapters/legacy-http';
import { catalogs } from '../infrastructure/database/repositories';
import * as equipmentService from '../services/equipment-service';
import * as ticketService from '../services/ticket-service';
type HttpRequest = Request<Record<string, string>, unknown, Record<string, unknown>>;

export async function createEquipment(request: HttpRequest, response: Response) {
  try {
    await equipmentService.createEquipment(readCreateEquipmentRequest(request.body));
    response.redirect('/registro_equipos');
  } catch (error) {
    respondError(response, error);
  }
}
export async function renderEquipmentInventory(_request: Request, response: Response) {
  try {
    const [models, inventory] = await Promise.all([
      equipmentService.getEquipmentModels(),
      equipmentService.getEquipmentInventory(),
    ]);
    response.render('registro_equipos', {
      equipos_stock: models.map(serializeEquipmentModel),
      equiposAsignados: inventory.map(serializeEquipment),
    });
  } catch (error) {
    respondError(response, error);
  }
}
export async function listAvailableEquipment(_request: Request, response: Response) {
  try {
    response.json((await equipmentService.getAvailableEquipment()).map(serializeEquipment));
  } catch (error) {
    respondError(response, error);
  }
}
export async function renderEquipmentAssignment(_request: Request, response: Response) {
  try {
    const [pendingTickets, availableEquipment, accessoryList] = await Promise.all([
      ticketService.getTicketsAwaitingEquipment(),
      equipmentService.getAvailableEquipment(),
      catalogs.listAccessories(),
    ]);
    response.render('asignacion_equipos', {
      ticketsSeguimiento: pendingTickets.map(serializeTicketSummary),
      equiposEnEspera: availableEquipment.map(serializeEquipment),
      accesoriosDisponibles: accessoryList.map(serializeAccessory),
    });
  } catch (error) {
    respondError(response, error);
  }
}
export async function assignEquipment(request: HttpRequest, response: Response) {
  try {
    const result = await equipmentService.assignEquipment(
      readEquipmentAssignment(request.body?.datosAsignacion),
      request.body?.idTicket,
    );
    response.json({
      success: true,
      message: 'Equipos asignados y ticket actualizado correctamente',
      resultado: { ...result, estatusFinal: result.assignmentStatus },
    });
  } catch (error) {
    respondError(response, error);
  }
}
export async function releaseEquipment(request: HttpRequest, response: Response) {
  try {
    const result = await equipmentService.releaseEquipment(
      request.body?.idUnidad,
      request.body?.idEquipo,
      request.body?.idTicket,
    );
    response.json({ ...result, estatusFinal: result.assignmentStatus });
  } catch (error) {
    respondError(response, error);
  }
}
export async function removeAccessory(request: HttpRequest, response: Response) {
  try {
    response.json(
      await equipmentService.removeAccessory(request.body?.idUnidad, request.body?.idAccesorio),
    );
  } catch (error) {
    respondError(response, error);
  }
}
