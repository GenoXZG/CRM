// routes/unidadRoutes.js
const express = require('express');
const router = express.Router();

// Controladores
const unidad_catalogo_controller = require('../controllers/catalogo_unidades_controller');
const Unidad_controller = require('../controllers/unidades_controller');


// === SECCIÓN A: CATÁLOGO (Tipos de Unidad) ===
router.get('/unidades', unidad_catalogo_controller.listarUnidadStock);
router.post('/add_unidad_catalogo', unidad_catalogo_controller.agregarUnidadStock);
router.post('/editar_unidad_stock', unidad_catalogo_controller.editarUnidadStock);
router.post('/eliminar_unidad_stock', unidad_catalogo_controller.eliminarUnidadStock);

// Filtrados para selects dinámicos
router.get('/modelos', unidad_catalogo_controller.modeloMarca);
router.get('/test', unidad_catalogo_controller.marcas);


// === SECCIÓN B: GESTIÓN OPERATIVA ===
// Agregar unidades a un ticket
router.post('/add_unidades', Unidad_controller.agregarUnidades);

// API JSON: Ver unidades de un ticket específico
router.get('/unidades-por-ticket/:id_ticket', Unidad_controller.apiObtenerUnidadesTicket);

module.exports = router;