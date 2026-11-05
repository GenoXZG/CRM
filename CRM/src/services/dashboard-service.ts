import { dashboardPeriod, shiftDay } from '../domain/dashboard-period';
import type { DashboardMetrics } from '../domain/entities';
import {
  getCalendarTickets,
  getEquipmentAvailability,
  getStatusCounts,
  getTechnicianWorkload,
  getSetupStatus,
  getOperationalCounts,
} from '../infrastructure/database/dashboard-repository';
import { withTransaction } from '../infrastructure/database/repositories';

export function getDashboard(input: Record<string, unknown> = {}, technician?: number) {
  const period = dashboardPeriod(input);
  return withTransaction(async (transaction) => {
    const [statuses, technicianWorkload, equipmentAvailability, agenda, setupStatus, operations] = await Promise.all([
      getStatusCounts(transaction, technician),
      getTechnicianWorkload(transaction, technician),
      technician === undefined ? getEquipmentAvailability(transaction) : Promise.resolve([]),
      getCalendarTickets(transaction, period.start, period.end, technician),
      technician === undefined ? getSetupStatus(transaction) : Promise.resolve({clients:0,technicians:0,equipment:0,units:0,accessories:0}),
      getOperationalCounts(transaction, period.today, shiftDay(period.today, 1), technician),
    ]);
    const metrics: DashboardMetrics = {
      totalTickets: statuses.reduce((total, status) => total + status.count, 0),
      counts: { waiting: 0, in_progress: 0, completed: 0 },
      technicianWorkload,
      equipmentAvailability,
    };
    for (const status of statuses) if (status.state) metrics.counts[status.state] = status.count;
    return { metrics, agenda, setupStatus, operations, period };
  });
}
