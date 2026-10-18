import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import * as tickets from '../controllers/ticket-controller';
const router = Router();
const storage = multer.diskStorage({
  destination(_request, _file, callback) {
    callback(null, 'public/uploads/tickets');
  },
  filename(request, file, callback) {
    const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    callback(null, `ticket_${request.params.id}_${suffix}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage });
router.get('/tickets', tickets.renderTicketForm);
router.post('/tickets/finalizar/:id', tickets.completeTicket);
router.post('/tickets/reabrir/:id', tickets.reopenTicket);
router.post('/tickets/asignar_tecnico', tickets.assignTechnician);
router.post('/tickets/actualizar_comentarios', tickets.updateComments);
router.post('/tickets/actualizar_maps', tickets.updateLocation);
router.get('/estado_tickets', tickets.renderTicketDashboard);
router.get('/asignacion_unidades', tickets.renderUnitAssignment);
router.get('/detalle_ticket/:id', tickets.renderTicketDetails);
router.post(
  '/tickets/:id/subir-fotos',
  tickets.requireOpenTicket,
  upload.array('fotos', 5),
  tickets.uploadPhotos,
);
router.post('/add_ticket', tickets.createTicket);
router.post('/updateAsignacionUnidades', tickets.confirmCompleteAssignment);
export default router;
