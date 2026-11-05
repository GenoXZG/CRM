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
    const [ticket, technicianList] = await Promise.all([
      ticketService.getTicketDetails(request.params.id, response.locals.technicianScope),
      response.locals.canManage ? technicians.list() : Promise.resolve([]),
    ]);
    const canAssign = response.locals.canManage && (ticket.status === 'waiting' || ticket.status === 'in_progress');
    const [availableEquipment, accessoryList, models] = canAssign ? await Promise.all([getAvailableEquipment(), catalogs.listAccessories(), getEquipmentModels()]) : [[], [], []];
    const history = await ticketHistory(ticket.id, request.query);
    const historyParams = new URLSearchParams({ returnTo: ticketListReturn(request.query.returnTo), history_size: String(history.size) });
    response.render('detalles_servicio', {
      history,
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
export const completeTicket = redirectMutation((id, _input, response) => ticketService.completeTicket(id, response.locals.technicianScope === undefined ? undefined : { userId: response.locals.currentUser.id_usuario, technicianId: response.locals.technicianScope }));
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
  try {
    await ticketService.savePhotos(request.params.id, files);
    response.redirect(ticketDetailsDestination(request.params.id!, request.body?.returnTo));
  } catch (error) {
    // Clean files if the ticket closes while the upload is in progress.
    await Promise.allSettled(files.map((file) => fs.unlink(file.path)));
    respondError(response, error);
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
