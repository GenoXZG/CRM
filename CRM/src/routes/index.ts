import { Router } from 'express';
import { postTestEmail } from '../controllers/test-email-controller';
import { renderDashboard } from '../controllers/dashboard-controller';
import equipmentRoutes from './equipment-routes';
import masterDataRoutes from './master-data-routes';
import ticketRoutes from './ticket-routes';
import unitRoutes from './unit-routes';

const router = Router();
router.get('/', renderDashboard);
router.post('/api/email/test', postTestEmail);
for (const routes of [masterDataRoutes, ticketRoutes, equipmentRoutes, unitRoutes])
  router.use('/', routes);
export default router;
