// routes/index.js
const express = require('express');
const router = express.Router();
const dashboard_controller = require('../controllers/dashboard_controller');

// Importación de módulos de ruta
const clienteRoutes = require('./clienteRoutes');
const tecnicoRoutes = require('./tecnicoRoutes');
const ticketRoutes = require('./ticketRoutes');
const equipoRoutes = require('./equipoRoutes');
const unidadRoutes = require('./unidadRoutes');
const accesorioRoutes = require('./accesorioRoutes');

// Ruta Home
router.get('/', dashboard_controller.viewDashboard);

// Montaje de rutas
// Usamos '/' para que las rutas definidas en los archivos se mantengan igual
// (ej: '/clientes' en clienteRoutes seguirá siendo '/clientes')
router.use('/', clienteRoutes);
router.use('/', tecnicoRoutes);/*  */
router.use('/', ticketRoutes);
router.use('/', equipoRoutes);
router.use('/', unidadRoutes);
router.use('/', accesorioRoutes);

module.exports = router;