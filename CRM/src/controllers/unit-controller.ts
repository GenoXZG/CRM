import type { Request, Response } from 'express';
import { respondError } from '../adapters/http-errors';
import { readUnitRegistration, serializeUnit, serializeUnitDetails } from '../adapters/legacy-http';
import { isRecord } from '../domain/business-error';
import * as unitService from '../services/unit-service';
type HttpRequest = Request<Record<string, string>, unknown, Record<string, unknown>>;

export async function registerUnits(request: HttpRequest, response: Response) {
  try {
    const input: unknown = request.body?.unidades;
    const first: unknown = Array.isArray(input) ? input[0] : undefined;
    const results = await unitService.registerUnits(
      readUnitRegistration(input),
      isRecord(first) ? first.ticketId : undefined,
    );
    response.json({
      success: true,
      message: 'Unidades registradas y ticket actualizado correctamente',
      unidadesCreadas: results.length,
      data: results.map(serializeUnit),
    });
  } catch (error) {
    respondError(response, error);
  }
}
export async function listUnitsByTicket(request: HttpRequest, response: Response) {
  try {
    response.json(
      (await unitService.getUnitsByTicket(request.params.id_ticket)).map(serializeUnitDetails),
    );
  } catch (error) {
    respondError(response, error);
  }
}
