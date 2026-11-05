import type { Request, Response } from 'express';
import { respondError } from '../adapters/http-errors';
import {
  readCreateEquipmentRequest,
  readEquipmentAssignment,
  serializeEquipment,
  serializeEquipmentModel,
} from '../adapters/legacy-http';
import * as equipmentService from '../services/equipment-service';
import { getInventory } from '../services/inventory-service';
import { getInventoryTotals } from '../infrastructure/database/inventory-repository';
type HttpRequest = Request<Record<string, string>, unknown, Record<string, unknown>>;

export async function updateEquipment(request: HttpRequest, response: Response) {
  try {
    const device = await equipmentService.updateEquipment(request.params.id, readCreateEquipmentRequest(request.body));
    response.json({ success: true, data: serializeEquipment(device) });
  } catch (error) { respondError(response, error); }
}
export async function deleteEquipment(request: HttpRequest, response: Response) {
  try {
    await equipmentService.deleteEquipment(request.params.id);
    response.json({ success: true });
  } catch (error) { respondError(response, error); }
}

export async function createEquipment(request: HttpRequest, response: Response) {
  try {
    const device = await equipmentService.createEquipment(readCreateEquipmentRequest(request.body));
    if (request.get('accept')?.includes('application/json')) {
      response.status(201).json({ success: true, data: serializeEquipment(device) });
      return;
    }
    const state = request.body?.inventoryState;
    const url = new URL(typeof state === 'string' && state.startsWith('/inventario?') && state.length < 5000 ? state : '/inventario', 'http://localhost');
    url.searchParams.set('created', String(device.id));
    response.redirect(url.pathname + url.search);
  } catch (error) {
    respondError(response, error);
  }
}
export async function renderEquipmentInventory(request: Request, response: Response) {
  try {
    const [models, result, totals] = await Promise.all([
      equipmentService.getEquipmentModels(), getInventory(request.query), getInventoryTotals(),
    ]);
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(result.filters)) if (value !== null && value !== '') params.set(key, String(value));
    const created = Number(request.query.created);
    response.render('registro_equipos', {
      ...result, totals,
      equipos_stock: models.map(serializeEquipmentModel),
      brands: [...new Set(models.map(model => model.brand))].sort((left, right) => left.localeCompare(right, 'es')),
      created: Number.isSafeInteger(created) && created > 0 && created <= 2147483647 ? created : null,
      notice: request.query.result === 'updated' ? 'Datos del equipo actualizados correctamente.' : request.query.result === 'deleted' ? 'Equipo eliminado correctamente.' : null,
      inventoryState: `/inventario?${params}`,
      pageUrl: (page: number) => { const next = new URLSearchParams(params); next.set('page', String(page)); return `/inventario?${next}`; },
    });
  } catch (error) { respondError(response, error); }
}
export async function listAvailableEquipment(_request: Request, response: Response) {
  try {
    response.json((await equipmentService.getAvailableEquipment()).map(serializeEquipment));
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
