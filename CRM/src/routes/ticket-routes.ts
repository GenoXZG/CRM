import { Router } from 'express';
import multer from 'multer';
import { assertCsrf } from '../csrf';
import path from 'node:path';
import * as tickets from '../controllers/ticket-controller';
import { renderAssignments } from '../controllers/assignment-controller';
import { resolveLocationLink } from '../controllers/maps-link-controller';
const router = Router();
router.get('/asignaciones', renderAssignments);
const storage = multer.diskStorage({
  destination(_request, _file, callback) {
    callback(null, 'public/uploads/tickets');
  },
  filename(request, file, callback) {
    const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    callback(null, `ticket_${request.params.id}_${suffix}${path.extname(file.originalname)}`);
  },
});
const verifiedUploads = new WeakSet<object>();
const upload = multer({
  storage,
  fileFilter(request, _file, callback) {
    try {
      if (!verifiedUploads.has(request)) {
        assertCsrf(request, request.res!);
        verifiedUploads.add(request);
      }
      callback(null, true);
    } catch (error) { callback(error as Error); }
  },
});
router.get('/tickets', tickets.renderTicketEntry);
router.get('/tickets/exportar', tickets.downloadTickets);
router.get('/tickets/nuevo', tickets.renderTicketForm);
router.post('/tickets/resolver_ubicacion', resolveLocationLink);
router.post('/tickets/finalizar/:id', tickets.completeTicket);
router.post('/tickets/reabrir/:id', tickets.reopenTicket);
router.post('/tickets/asignar_tecnico', tickets.assignTechnician);
router.post('/tickets/actualizar_comentarios', tickets.updateComments);
router.post('/tickets/actualizar_maps', tickets.updateLocation);
router.get('/estado_tickets', tickets.renderTicketDashboard);
router.get('/asignacion_unidades', renderAssignments);
router.get('/detalle_ticket/:id', tickets.renderTicketDetails);
router.post(
  '/tickets/:id/subir-fotos',
  tickets.requireOpenTicket,
  upload.array('fotos', 5),
  (request, response, next) => {
    if (!verifiedUploads.has(request) && request.is('multipart/form-data')) assertCsrf(request, response);
    next();
  },
  tickets.uploadPhotos,
);
router.post('/add_ticket', tickets.createTicket);
router.post('/updateAsignacionUnidades', tickets.confirmCompleteAssignment);
export default router;
