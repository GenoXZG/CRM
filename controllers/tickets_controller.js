const ticketService = require('../services/ticketService');
const TicketFoto = require('../models/Ticket_foto');
const tecnicoService = require('../services/tecnicoService');
const agregarTicket = async (req, res) => {
    try {
        
        await ticketService.createTicket(req.body);
        res.redirect('/tickets');
    } catch (error) {
        console.error('Error al agregar ticket:', error);
        
        res.status(500).send("Error al crear el ticket");
    }
};

const viewTicketsEspera = async (req, res) => {
    try {
        // Ejecutamos ambas consultas en paralelo para mejorar performance
        const [ticketsEspera, unidades] = await Promise.all([
            ticketService.getTicketsEnEspera(),
            ticketService.getUnidadesDisponibles()
        ]);

        res.render('asignacion_unidades', {
            ticketsEspera,
            unidades
        });
    } catch (error) {
        console.error('Error al renderizar asignacion_unidades:', error);
        res.status(500).send('Error interno del servidor');
    }
};

const verDetalleTicket = async(req,res) => {

    try {
        const ticket = await ticketService.verDetalleTicket(req.params);
        const tecnicos = await tecnicoService.listarTecnicos();
        res.render('detalles_servicio', { ticket,tecnicos });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error del servidor');
    }

};

const actualizarMaps = async(req,res) =>{
    try {
    const {ID_ticket, Link_maps} = req.body;
    await ticketService.actualizarMaps(ID_ticket, Link_maps);
    res.redirect(`/detalle_ticket/${ID_ticket}`);
    } catch (error) {
        console.log("Error en el controlador: " ,error);
    }
};


const reabrirTicket = async(req,res) => {
    try {
     const {id} = req.params;
     console.log(id);
     await ticketService.reabrirTicket(id); 
     res.redirect(`/detalle_ticket/${id}`);  
    } catch (error) {
        console.log("Error en el controlador: " ,error);
    }
};

const subirFotos = async (req, res) => {
    try {
        const idTicket = req.params.id;
        const archivos = req.files; 

        if (!archivos || archivos.length === 0) {
            return res.redirect(`/detalle_ticket/${idTicket}`);
        }
        const promesasFotos = archivos.map(file => {
            return TicketFoto.create({
                ID_ticket: idTicket,
                Ruta_archivo: `/uploads/tickets/${file.filename}`, 
                Nombre_original: file.originalname
            });
        });

        await Promise.all(promesasFotos);

        res.redirect(`/detalle_ticket/${idTicket}`);
    } catch (error) {
        console.error("Error subiendo fotos:", error);
        res.redirect(`/detalle_ticket/${req.params.id}`);
    }
};


const apiTicketsSeguimiento = async (req, res) => {
    try {
        const data = await ticketService.getTicketsEnSeguimientoSinUnidad();
        res.json(data);
    } catch (error) {
        console.error('Error en API seguimiento:', error);
        res.status(500).json({ error: 'Error interno' });
    }
};

const marcarUnidadAsignada = async (req, res) => {
    const { idTicket } = req.body; 
    try {
        await ticketService.asignarUnidadATicket(idTicket);
        res.json({ success: true, message: 'Unidad asignada correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Error al actualizar' });
    }
};

const viewEstadoTickets = async (req, res) => { 
    try {
        const datosDashboard = await ticketService.getAllTicketsDashboard();

        res.render('estado_tickets', {
            ticketsEspera: datosDashboard.ticketsEspera,
            ticketsSeguimiento: datosDashboard.ticketsSeguimiento,
            ticketsFinalizados: datosDashboard.ticketsFinalizados
        });
    } catch (error) {
        console.error('Error en dashboard tickets:', error);
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
};

module.exports = {
    agregarTicket,
    verDetalleTicket,
    viewTicketsEspera,   
    apiTicketsSeguimiento,
    marcarUnidadAsignada, 
    viewEstadoTickets,
    actualizarMaps,
    reabrirTicket,
    subirFotos    
};