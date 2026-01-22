const express = require('express');
const router = express.Router();
const cliente_controller = require("../controllers/clientes_controller");



router.post('/add_cliente', cliente_controller.agregarCliente);
router.get('/clientes', cliente_controller.listarClientes);
router.post('/editar_cliente', cliente_controller.editarCliente);
router.post('/eliminar_cliente', cliente_controller.eliminarCliente);


module.exports = router;