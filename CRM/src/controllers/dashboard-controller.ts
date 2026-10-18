import type { Request, Response } from 'express';
import { serializeCalendarTicket, serializeDashboardMetrics } from '../adapters/dashboard-http';
import { respondError } from '../adapters/http-errors';
import { getDashboard } from '../services/dashboard-service';

export async function renderDashboard(_request: Request, response: Response) {
  try {
    const snapshot = await getDashboard();
    response.render('index', {
      metrics: serializeDashboardMetrics(snapshot.metrics),
      calendarEvents: snapshot.tickets.map(serializeCalendarTicket),
      setupStatus: snapshot.setupStatus,
    });
  } catch (error) {
    respondError(response, error);
  }
}
