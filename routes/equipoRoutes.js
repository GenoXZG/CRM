// routes/equipoRoutes.js
const express = require('express');
const router = express.Router();

// Controladores
const equipo_catalogo_controller = require("../controllers/catalogo_equipos_controller");
const Equipo_controller = require('../controllers/equipos_controller');

// Servicios (Para la vista combinada de asignación)
const ticketService = require('../services/ticketService');
const equipoService = require('../services/equipoService');
const accesorioService = require('../services/catalogoAccesorioService');

// === SECCIÓN A: CATÁLOGO (Stock/Modelos) ===
router.get('/equipos', equipo_catalogo_controller.listarEquiposStock);
router.post('/add_equipo_catalogo', equipo_catalogo_controller.agregarEquipoStock);
router.post('/editar_equipo_stock', equipo_catalogo_controller.editarEquipoStock);
router.post('/eliminar_equipo_stock', equipo_catalogo_controller.eliminarEquipoStock);


// === SECCIÓN B: INVENTARIO (Equipos Reales) ===
router.get("/registro_equipos", Equipo_controller.viewRegistroEquipos);
router.post('/add_equipo', Equipo_controller.agregarEquipo);

// API JSON
router.get('/equipos_espera', Equipo_controller.apiEquiposEnEspera);



router.get('/asignacion_equipos', async (req, res) => { 
  try {
    const [ticketsSeguimiento, equiposEnEspera, accesoriosDisponibles] = await Promise.all([
        ticketService.getTicketsEnSeguimientoSinUnidad(), 
        equipoService.getEquiposEnEspera(),
        accesorioService.listarAccesoriosStock()
    ]);
    res.render('asignacion_equipos', { ticketsSeguimiento, equiposEnEspera, accesoriosDisponibles });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al obtener datos para asignación');
  }
});


router.post('/desvincular_equipo', Equipo_controller.desvincularEquipo);
router.post('/desvincular_accesorio',Equipo_controller.desvincularAccesorio);

router.post('/asignar_equipos', Equipo_controller.realizarAsignacionMasiva);

module.exports = router;