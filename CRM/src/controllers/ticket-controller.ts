import { safeLocationLink } from '../domain/location';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { QueryTypes, Transaction } from 'sequelize';
import { sessionToken, type SessionUser } from '../auth';
import { tokenHash } from '../auth-challenge';
import { database } from '../infrastructure/database/connection';
import { EvidenceBusyError, EvidenceSpaceError, evidenceRoute, maxFileBytes, normalizeEvidence, normalizeLegacyEvidence, openEvidence, requireEvidenceSpace, safeEvidenceName, validatedEvidence, validatedEvidenceType } from '../services/ticket-evidence';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { exportTickets } from '../infrastructure/database/ticket-search-repository';
import { ticketCsv } from '../adapters/ticket-csv';
import { ticketHistory } from '../infrastructure/database/ticket-history-repository';
import { getScopedTicketFilterOptions } from '../infrastructure/database/ticket-search-repository';
import fs from 'node:fs/promises';
import type { NextFunction, Request, Response } from 'express';
import { respondError } from '../adapters/http-errors';
import {
  readCreateTicketRequest,
  serializeAccessory,
  serializeEquipment,
  serializeEquipmentModel,
  serializeClient,
  serializeTechnician,
  serializeTicketDetails,
  serializeTicketSummary,
} from '../adapters/legacy-http';
import { catalogs, clients, technicians } from '../infrastructure/database/repositories';
import * as ticketService from '../services/ticket-service';
import { getTicketList, readTicketFilters } from '../services/ticket-search-service';
import { getAvailableEquipment, getEquipmentModels } from '../services/equipment-service';
import { getTicketPreparation } from '../services/ticket-lifecycle';
import { BusinessError, isRecord } from '../domain/business-error';
import { ticketDetailsDestination, ticketListReturn } from '../adapters/ticket-navigation';

type HttpRequest = Request<Record<string, string>, unknown, Record<string, unknown>>;
export async function renderTicketForm(request: Request, response: Response) {
  try {
    const [clientList, technicianList] = await Promise.all([clients.list(), technicians.list()]);
    response.render('tickets', {
      clientes: clientList.map(serializeClient),
      tecnicos: technicianList
        .filter((technician) => technician.status === 'active')
        .map(serializeTechnician),
      setupWizard: request.query.setup === 'ticket',
      ticketListState: ticketListReturn(request.query.returnTo),
    });
  } catch (error) {
    respondError(response, error);
  }
}
export async function createTicket(request: HttpRequest, response: Response) {
  try {
    if (!request.body?.ID_cliente) {
      if (request.get('accept')?.includes('application/json')) throw new BusinessError(400, 'El campo Cliente es obligatorio');
      const [clientList, technicianList] = await Promise.all([clients.list(), technicians.list()]);
      response.status(400).render('tickets', {
        alert: true,
        alertTitle: 'Error',
        alertMessage: 'El campo Cliente es obligatorio',
        alertIcon: 'error',
        clientes: clientList.map(serializeClient),
        tecnicos: technicianList
          .filter((technician) => technician.status === 'active')
          .map(serializeTechnician),
        data: request.body,
        setupWizard: request.body?.setupWizard === 'ticket',
        ticketListState: ticketListReturn(request.body?.returnTo),
      });
      return;
    }
    const ticket = await ticketService.createTicket(readCreateTicketRequest(request.body));
    const destination = request.body?.setupWizard === 'ticket' ? '/?setupTicketCreated=1' : ticketDetailsDestination(ticket.id, request.body?.returnTo);
    if (request.get('accept')?.includes('application/json')) {
      response.status(201).json({ success: true, redirect: destination, ticketId: ticket.id });
      return;
    }
    response.redirect(destination);
  } catch (error) {
    respondError(response, error);
  }
}
export async function renderTicketDetails(request: HttpRequest, response: Response) {
  try {
    const scope: number | undefined = response.locals.technicianScope;
    const [{ ticket, history }, technicianList] = await Promise.all([
      database.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ, readOnly: true }, async transaction => {
        const ticket = await ticketService.getTicketDetails(request.params.id, transaction, scope);
        return { ticket, history: await ticketHistory(ticket.id, request.query, transaction) };
      }),
      response.locals.canManage ? technicians.list() : Promise.resolve([]),
    ]);
    const canAssign = response.locals.canManage && (ticket.status === 'waiting' || ticket.status === 'in_progress');
    const [availableEquipment, accessoryList, models] = canAssign ? await Promise.all([getAvailableEquipment(), catalogs.listAccessories(), getEquipmentModels()]) : [[], [], []];
    const historyParams = new URLSearchParams({ returnTo: ticketListReturn(request.query.returnTo), history_size: String(history.size) });
    response.render('detalles_servicio', {
      history,
      safeMapsHref: safeLocationLink(ticket.locationUrl),
      historyPageUrl: (page: number) => { const params=new URLSearchParams(historyParams); params.set('history_page',String(page)); return `/detalle_ticket/${ticket.id}?${params}#ticket-history`; },
      backToTickets: ticketListReturn(request.query.returnTo),
      canAssign,
      equipos_stock: models.map(serializeEquipmentModel),
      preparation: getTicketPreparation(ticket),
      equiposEnEspera: availableEquipment.map(serializeEquipment),
      accesoriosDisponibles: accessoryList.map(serializeAccessory),
      ticket: serializeTicketDetails(ticket),
      tecnicos: technicianList.map(serializeTechnician),
    });
  } catch (error) {
    respondError(response, error);
  }
}
function redirectMutation(
  operation: (id: unknown, body: Record<string, unknown>, response: Response) => Promise<unknown>,
) {
  return async (request: HttpRequest, response: Response) => {
    try {
      const input: Record<string, unknown> = isRecord(request.body) ? request.body : {};
      const id = request.params.id || input.ID_ticket;
      await operation(id, input, response);
      response.redirect(ticketDetailsDestination(String(id), input.returnTo));
    } catch (error) {
      respondError(response, error);
    }
  };
}
export const updateLocation = redirectMutation((id, input) =>
  ticketService.updateLocation(id, input.Link_maps),
);
export const updateComments = redirectMutation((id, input) =>
  ticketService.updateComments(id, input.Comentarios),
);
export const assignTechnician = redirectMutation((id, input) =>
  ticketService.assignTechnician(id, input.ID_tecnico),
);
export const completeTicket = redirectMutation((id, _input, response) => {
  const user = response.locals.currentUser as SessionUser | null;
  const token = sessionToken(response.req);
  if (!user || !token) throw new BusinessError(401, 'Debes iniciar sesión.');
  return ticketService.completeTicket(id, {
    userId: user.id_usuario, role: user.rol, sessionHash: tokenHash(token),
    technicianId: response.locals.technicianScope,
  });
});
export const reopenTicket = redirectMutation((id) => ticketService.reopenTicket(id));
export async function requireOpenTicket(
  request: HttpRequest,
  response: Response,
  next: NextFunction,
) {
  try {
    await ticketService.requireOpenTicket(request.params.id);
    next();
  } catch (error) {
    respondError(response, error);
  }
}
export async function uploadPhotos(request: HttpRequest, response: Response) {
  const files = Array.isArray(request.files) ? request.files : [];
  const created: string[] = [];
  const saved: Array<{ filename: string; originalname: string }> = [];
  const ensureConnected = () => {
    if (request.aborted || response.destroyed) throw new BusinessError(400, 'La carga se interrumpió.');
  };
  let committed = false;
  let failure: unknown;
  try {
    for (const file of files) {
      if (!safeEvidenceName(file.originalname)) throw new BusinessError(400, 'Nombre de archivo inválido.');
      const image = await normalizeEvidence(file.buffer, file);
      ensureConnected();
      await requireEvidenceSpace(image.buffer.length);
      ensureConnected();
      const filename = `${randomUUID()}.${image.extension}`;
      const target = path.join(validatedEvidence, filename);
      const handle = await fs.open(target, 'wx', 0o600);
      created.push(target);
      try { await handle.writeFile(image.buffer); }
      finally { await handle.close(); }
      saved.push({ filename, originalname: file.originalname });
    }
    ensureConnected();
    await ticketService.savePhotos(request.params.id, saved, ensureConnected);
    committed = true;
    if (!response.destroyed) response.redirect(ticketDetailsDestination(request.params.id!, request.body?.returnTo));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    failure = code === 'ENOSPC' || code === 'EDQUOT' ? new EvidenceSpaceError() : error;
    if (failure instanceof EvidenceSpaceError) console.warn('evidence_storage_unavailable');
  } finally {
    if (!committed) {
      const results = await Promise.allSettled(created.map(target => fs.unlink(target)));
      if (results.some(result => result.status === 'rejected')) console.error('Evidence cleanup failed');
    }
  }
  if (!committed && !response.destroyed) {
    if (failure instanceof EvidenceBusyError) response.set('Retry-After', '5');
    if (failure instanceof BusinessError) respondError(response, failure);
    else {
      console.error('Evidence persistence failed');
      response.status(500).json({ error: 'No se pudo guardar la evidencia.' });
    }
  }
}

export async function serveEvidence(request: Request<{ name: string }>, response: Response, next: NextFunction) {
  const { name } = request.params;
  if (!safeEvidenceName(name)) return response.status(404).send('Evidencia no encontrada');
  const scope: number | undefined = response.locals.technicianScope;
  const [photo] = await database.query<{ found: number }>(
    `SELECT 1 AS found FROM Ticket_fotos f JOIN Tickets t ON t.ID_ticket=f.ID_ticket
    WHERE BINARY f.Ruta_archivo=?${scope === undefined ? '' : ' AND t.ID_tecnico=?'} LIMIT 1`,
    { type: QueryTypes.SELECT, replacements: scope === undefined ? [evidenceRoute + name] : [evidenceRoute + name, scope] },
  );
  if (!photo) return response.status(404).send('Evidencia no encontrada');
  const file = await openEvidence(name);
  if (!file) return response.status(404).send('Evidencia no encontrada');
  try {
    if (!file.validated && file.size <= maxFileBytes) {
      const abort = new AbortController();
      const onClose = () => abort.abort();
      response.once('close', onClose);
      const image = await normalizeLegacyEvidence(async () => {
        if (response.destroyed) return null;
        const bytes = await file.handle.readFile({ signal: abort.signal });
        return response.destroyed ? null : bytes;
      }).finally(() => response.off('close', onClose));
      if (response.destroyed) return;
      if (image) return response.type(image.mime).send(image.buffer);
    }
    if (file.validated) response.type(validatedEvidenceType(name));
    else {
      response.type('application/octet-stream');
      response.set('Content-Disposition', 'attachment');
      response.set('Content-Security-Policy', 'sandbox');
    }
    response.set('Content-Length', String(file.size));
    if (request.method === 'HEAD') return response.end();
    await pipeline(file.handle.createReadStream({ start: 0, autoClose: false }), response);
  } catch (error) {
    if (!response.destroyed && error instanceof EvidenceBusyError) response.set('Retry-After', '5');
    if (!response.destroyed) next(error);
  } finally {
    await file.handle.close();
  }
}

export async function confirmCompleteAssignment(request: HttpRequest, response: Response) {
  try {
    await ticketService.confirmCompleteAssignment(request.body?.idTicket);
    response.json({ success: true, message: 'Unidad asignada correctamente' });
  } catch (error) {
    respondError(response, error);
  }
}
export async function renderTicketDashboard(request: Request, response: Response) {
  try {
    const scope = response.locals.technicianScope as number | undefined;
    const [result, options] = await Promise.all([
      getTicketList(request.query, scope),
      scope === undefined ? Promise.all([clients.list(), technicians.list()]).then(([clients, technicians]) => ({ clients, technicians })) : getScopedTicketFilterOptions(scope),
    ]);
    const clientList = options.clients, technicianList = options.technicians;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(result.filters)) {
      if (value !== null && value !== '') params.set(key, String(value));
    }
    params.set('page', String(result.page));
    response.render('estado_tickets', {
      ...result,
      tickets: result.tickets.map(serializeTicketSummary),
      clientes: clientList.map(serializeClient),
      tecnicos: technicianList.map(serializeTechnician),
      ticketListState: `/tickets?${params}`,
      exportUrl: `/tickets/exportar?${params}`,
      pageUrl: (page: number) => { const next = new URLSearchParams(params); next.set('page', String(page)); return `/tickets?${next}`; },
    });
  } catch (error) { respondError(response, error); }
}
export async function renderTicketEntry(request: Request, response: Response) {
  if (request.query.setup === 'ticket') return renderTicketForm(request, response);
  return renderTicketDashboard(request, response);
}

export async function downloadTickets(request: Request, response: Response) {
  try {
    const filters = readTicketFilters(request.query, response.locals.technicianScope as number | undefined);
    response.type('text/csv; charset=utf-8');
    response.attachment(`tickets-${new Date().toISOString().slice(0, 10)}.csv`);
    await pipeline(Readable.from(ticketCsv(exportTickets(filters, response.locals.technicianScope as number | undefined))), response);
  } catch (error) {
    if (!response.headersSent && !response.destroyed) respondError(response, error);
    else if (!request.destroyed) console.error('Ticket export failed:', error instanceof Error ? error.name : 'unknown');
  }
}
