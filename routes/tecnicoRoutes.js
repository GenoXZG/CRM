const express = require('express');
const router = express.Router();
const tecnico_controller = require("../controllers/tecnicos_controller");

router.post('/add_tecnico', tecnico_controller.agregarTecnico);
router.get('/tecnicos', tecnico_controller.listarTecnicos);
router.post('/editar_tecnico', tecnico_controller.editarTecnico);
router.post('/eliminar_tecnico', tecnico_controller.eliminarTecnico);


module.exports = router;