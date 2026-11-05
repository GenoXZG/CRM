import type { Request, Response } from 'express';
import { serializeDashboardMetrics } from '../adapters/dashboard-http';
import { respondError } from '../adapters/http-errors';
import { getDashboard } from '../services/dashboard-service';
import { shiftDay } from '../domain/dashboard-period';

export async function renderDashboard(request: Request, response: Response) {
  try {
    const snapshot = await getDashboard(request.query, response.locals.technicianScope);
    const formatDate = (date: string) => new Intl.DateTimeFormat('es-MX', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
    response.render('index', {
      ...snapshot,
      metrics: serializeDashboardMetrics(snapshot.metrics),
      technicians: snapshot.metrics.technicianWorkload,
      stock: snapshot.metrics.equipmentAvailability,
      formatDate,
      agendaDays: Array.from({ length: snapshot.period.days }, (_, i) => {
        const date = shiftDay(snapshot.period.start, i);
        return { date, tickets: snapshot.agenda.tickets.filter(ticket => ticket.scheduledAt?.toISOString().slice(0, 10) === date) };
      }),
    });
  } catch (error) { respondError(response, error); }
}
