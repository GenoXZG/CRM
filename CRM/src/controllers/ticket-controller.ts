import fs from 'node:fs/promises';
import type { NextFunction, Request, Response } from 'express';
import { respondError } from '../adapters/http-errors';
import {
  readCreateTicketRequest,
  serializeAccessory,
  serializeEquipment,
  serializeClient,
  serializeTechnician,
  serializeTicketDetails,
  serializeTicketSummary,
} from '../adapters/legacy-http';
import { catalogs, clients, technicians } from '../infrastructure/database/repositories';
import * as ticketService from '../services/ticket-service';
import { getTicketList } from '../services/ticket-search-service';
import { getAvailableEquipment } from '../services/equipment-service';
import { getTicketPreparation } from '../services/ticket-lifecycle';
import { isRecord } from '../domain/business-error';

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
    });
  } catch (error) {
    respondError(response, error);
  }
}
export async function createTicket(request: HttpRequest, response: Response) {
  try {
    if (!request.body?.ID_cliente) {
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
      });
      return;
    }
    const ticket = await ticketService.createTicket(readCreateTicketRequest(request.body));
    if (request.body?.setupWizard === 'ticket') {
      response.redirect('/?setupTicketCreated=1');
      return;
    }
    response.redirect(`/detalle_ticket/${ticket.id}`);
  } catch (error) {
    respondError(response, error);
  }
}
export async function renderTicketDetails(request: HttpRequest, response: Response) {
  try {
    const [ticket, technicianList] = await Promise.all([
      ticketService.getTicketDetails(request.params.id),
      technicians.list(),
    ]);
    const canAssign = ticket.status === 'waiting' || ticket.status === 'in_progress';
    const [availableEquipment, accessoryList] = canAssign ? await Promise.all([getAvailableEquipment(), catalogs.listAccessories()]) : [[], []];
    response.render('detalles_servicio', {
      canAssign,
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
  operation: (id: unknown, body: Record<string, unknown>) => Promise<unknown>,
) {
  return async (request: HttpRequest, response: Response) => {
    try {
      const input: Record<string, unknown> = isRecord(request.body) ? request.body : {};
      const id = request.params.id || input.ID_ticket;
      await operation(id, input);
      response.redirect(`/detalle_ticket/${id}`);
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
export const completeTicket = redirectMutation((id) => ticketService.completeTicket(id));
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
    response.redirect(`/detalle_ticket/${request.params.id}`);
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
    const [result, clientList, technicianList] = await Promise.all([
      getTicketList(request.query), clients.list(), technicians.list(),
    ]);
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(result.filters)) {
      if (value !== null && value !== '') params.set(key, String(value));
    }
    response.render('estado_tickets', {
      ...result,
      tickets: result.tickets.map(serializeTicketSummary),
      clientes: clientList.map(serializeClient),
      tecnicos: technicianList.map(serializeTechnician),
      pageUrl: (page: number) => { const next = new URLSearchParams(params); next.set('page', String(page)); return `/tickets?${next}`; },
    });
  } catch (error) { respondError(response, error); }
}
export async function renderTicketEntry(request: Request, response: Response) {
  if (request.query.setup === 'ticket') return renderTicketForm(request, response);
  return renderTicketDashboard(request, response);
}
