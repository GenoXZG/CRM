import { Router } from 'express';
import { renderDashboard } from '../controllers/dashboard-controller';
import equipmentRoutes from './equipment-routes';
import masterDataRoutes from './master-data-routes';
import ticketRoutes from './ticket-routes';
import unitRoutes from './unit-routes';

const router = Router();
router.get('/', renderDashboard);
for (const routes of [masterDataRoutes, ticketRoutes, equipmentRoutes, unitRoutes])
  router.use('/', routes);
export default router;
