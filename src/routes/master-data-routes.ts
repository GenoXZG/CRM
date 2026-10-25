import { Router } from 'express';
import { accessoryCatalog, clients, technicians } from '../controllers/master-data-controller';

import { renderCatalogs } from '../controllers/catalog-controller';

const router = Router();
router.get('/catalogos', renderCatalogs);
router.get('/clientes', clients.list);
router.post('/add_cliente', clients.create);
router.post('/editar_cliente', clients.update);
router.post('/eliminar_cliente', clients.remove);
router.get('/tecnicos', technicians.list);
router.post('/add_tecnico', technicians.create);
router.post('/editar_tecnico', technicians.update);
router.post('/eliminar_tecnico', technicians.remove);
router.get('/accesorios', renderCatalogs);
router.post('/add_accesorio_catalogo', accessoryCatalog.create);
router.post('/editar_accesorio_stock', accessoryCatalog.update);
router.post('/eliminar_accesorio_stock', accessoryCatalog.remove);
export default router;
