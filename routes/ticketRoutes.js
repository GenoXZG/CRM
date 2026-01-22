// routes/ticketRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const ticket_controller = require('../controllers/tickets_controller');
const { Cliente, Tecnico, Ticket } = require('../models/index'); 


router.get('/tickets', async(req, res) => {
  try{
    const clientes =  await Cliente.findAll(); 
    const tecnicos = await Tecnico.findAll({
      where : { Estatus_tecnico : 'Activo' },
    });
    res.render('tickets', {clientes, tecnicos});
  }
  catch (error) {
    console.error("Error al renderizar vista tickets:", error);
    res.status(500).send("Error interno");
  }
});


router.get('/tickets/finalizar/:id', async (req, res) => {
    try {
        await Ticket.update(
            { Estatus_servicio: 'Finalizado' }, 
            { where: { ID_ticket: req.params.id } }
        );
        
        res.redirect(`/detalle_ticket/${req.params.id}`);
    } catch (error) {
        console.error(error);
        res.redirect('/tickets');
    }
});


const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/tickets');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'ticket_' + req.params.id + '_' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });


router.post('/tickets/asignar_tecnico', async(req, res) =>{
  try {
    const {ID_ticket, ID_tecnico} = req.body;
    await Ticket.update(
      {ID_tecnico : ID_tecnico},
      {where: {ID_ticket : ID_ticket}}
    );
    res.redirect(`/detalle_ticket/${ID_ticket}`);
  } catch (error) {
    console.log("Error al asignar el tecnico, desde la ruta:tickets/asignar_tecnico ")
  }
});

router.post('/tickets/actualizar_comentarios', async (req,res) => {
  try {
    const {ID_ticket, Comentarios} = req.body
    await Ticket.update(
      {Comentarios: Comentarios},
      {where: {ID_ticket : ID_ticket}}
    );
    res.redirect(`/detalle_ticket/${ID_ticket}`);
  } catch (error) {
    console.log("Error en la ruta:", error);
    res.status(500).send("Error interno");
  }
});


router.post('/tickets/actualizar_maps', ticket_controller.actualizarMaps);

router.get('/tickets/reabrir/:id', ticket_controller.reabrirTicket);



router.get('/estado_tickets', ticket_controller.viewEstadoTickets);

router.get('/asignacion_unidades', ticket_controller.viewTicketsEspera);
router.get('/detalle_ticket/:id', ticket_controller.verDetalleTicket);

router.post('/tickets/:id/subir-fotos', upload.array('fotos', 5), ticket_controller.subirFotos);



router.post('/add_ticket', ticket_controller.agregarTicket);


router.post('/updateAsignacionUnidades', ticket_controller.marcarUnidadAsignada);

module.exports = router;