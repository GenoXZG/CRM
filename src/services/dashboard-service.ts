import type { DashboardMetrics } from '../domain/entities';
import {
  getCalendarTickets,
  getEquipmentAvailability,
  getStatusCounts,
  getTechnicianWorkload,
  getSetupStatus,
} from '../infrastructure/database/dashboard-repository';
import { withTransaction } from '../infrastructure/database/repositories';

export function getDashboard() {
  return withTransaction(async (transaction) => {
    const [statuses, technicianWorkload, equipmentAvailability, tickets, setupStatus] = await Promise.all([
      getStatusCounts(transaction),
      getTechnicianWorkload(transaction),
      getEquipmentAvailability(transaction),
      getCalendarTickets(transaction),
      getSetupStatus(transaction),
    ]);
    const metrics: DashboardMetrics = {
      totalTickets: statuses.reduce((total, status) => total + status.count, 0),
      counts: { waiting: 0, in_progress: 0, completed: 0 },
      technicianWorkload,
      equipmentAvailability,
    };
    for (const status of statuses) if (status.state) metrics.counts[status.state] = status.count;
    return { metrics, tickets, setupStatus };
  });
}
