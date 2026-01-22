// routes/accesorioRoutes.js
const express = require('express');
const router = express.Router();
const accesorio_catalogo_controller = require('../controllers/catalogo_accesorios_controller');

router.get('/accesorios', accesorio_catalogo_controller.listarAccesoriosStock);
router.post('/add_accesorio_catalogo', accesorio_catalogo_controller.agregarAccesorioStock);
router.post('/editar_accesorio_stock', accesorio_catalogo_controller.editarAccesorioStock);
router.post('/eliminar_accesorio_stock', accesorio_catalogo_controller.eliminarAccesorioStock);

module.exports = router;