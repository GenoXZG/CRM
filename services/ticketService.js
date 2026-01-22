const { Ticket, Cliente, Tecnico, TicketFoto, Unidad, Equipo, Unidad_stock, Equipo_stock, Accesorio_stock } = require('../models/index');
const { Op } = require('sequelize');
const createTicket = async (data) => {
    
    let idTecnico = data.ID_Tecnico;
    if (idTecnico === 'null') {
        idTecnico = null;
    }

    let ubicacion = data.direccion_servicio;
    if (ubicacion === 'Pendiente'){
        ubicacion = null;
    }

    
    const newTicket = await Ticket.create({
        ID_tecnico: idTecnico,
        ID_cliente: data.ID_cliente,
        Tipo_servicio: data.Tipo_servicio,
        Numero_unidades: data.numero_unidades,
        Fecha_servicio: data.fecha_registro,
        Link_maps: ubicacion,
        Comentarios: data.comentarios
    });
    
    return newTicket;
};

const verDetalleTicket = async (ID) => {
    
    const { id } = ID; 
    try {
        const ticket = await Ticket.findOne({
            where: { ID_ticket: id },
            include: [
                { model: Cliente }, // Relación directa con Cliente
                { model: Tecnico }, // Relación directa con Técnico
                { model: TicketFoto }, // Relación con Fotos
                { 
                    model: Unidad, 
                    include: [
                        { 
                            model: Unidad_stock,
                            required: false 
                        },
                        { 
                            model: Equipo,
                            required: false, 
                            include: [
                                {
                                    model: Equipo_stock,
                                    required: false
                                }
                            ]
                        },
                        { 
                            model: Accesorio_stock, 
                            through: { attributes: [] } 
                        }
                    ]
                }
            ]
        });
        if (!ticket) {
            console.log("Ticket no encontrado");
        }
        return ticket;
        
    } catch (error) {
        console.error(error);
    }
};


const getTicketsEnEspera = async () => {
    return await Ticket.findAll({
        where: { Estatus_servicio: 'En espera' },
        attributes: [
            'ID_ticket', 'Tipo_servicio', 'Estatus_servicio', 
            'Numero_unidades', 'Fecha_servicio', 'Link_maps', 'Comentarios'
        ],
        include: [
            { model: Cliente, attributes: ['Nombre_empresa'] },
            { model: Tecnico, attributes: ['Nombre_tecnico'], required: false }
        ]
    });
};

const getUnidadesDisponibles = async () => {
    return await Unidad_stock.findAll({
        attributes: ['ID_Unidad_modelo', 'Marca_unidad', 'Modelo_Unidad']
    });
};

const getTicketsEnSeguimientoSinUnidad = async () => {
    return await Ticket.findAll({
        where: {
            Estatus_servicio: 'En seguimiento',
            Estatus_unidades: {
                [Op.in]: [0, 2] 
            }
        },
        attributes: ['ID_ticket', 'Tipo_servicio', 'Estatus_servicio', 'Numero_unidades', 'Estatus_unidades'], 
        include: [
            { model: Cliente, attributes: ['Nombre_empresa'] },
            { model: Tecnico, attributes: ['Nombre_tecnico'], required: false }
        ]
    });
};

const asignarUnidadATicket = async (idTicket) => {
    return await Ticket.update(
        { Estatus_unidades: 1 },
        { where: { ID_ticket: idTicket } } 
    );
};



const getAllTicketsDashboard = async () => {
    const tickets = await Ticket.findAll({
        attributes: ['ID_ticket', 'Tipo_servicio', 'Estatus_servicio', 'Numero_unidades'],
        include: [
            { model: Cliente, attributes: ['Nombre_empresa'] },
            { model: Tecnico, attributes: ['Nombre_tecnico'], required: false }
        ]
    });
    return {
        ticketsEspera: tickets.filter(t => t.Estatus_servicio === 'En espera'),
        ticketsSeguimiento: tickets.filter(t => t.Estatus_servicio === 'En seguimiento'),
        ticketsFinalizados: tickets.filter(t => t.Estatus_servicio === 'Finalizado')
    };
};

const actualizarMaps = async (idTicket, nuevoURL) =>{
    try {
       const actualizacion =  await Ticket.update(
            {Link_maps : nuevoURL},
            {where: {ID_ticket : idTicket}}
        );
        return actualizacion;
    } catch (error) {
        console.log("Error al actualizar desde el servicio");
    }

};

const reabrirTicket = async (idTicket) =>{
    try {
        const resultado = await Ticket.update(
            {Estatus_servicio: "En seguimiento"},
            {where: {ID_ticket : idTicket}}
        );
        return actualizacion;
    } catch (error) {
         console.log("Error al actualizar desde el servicio de reapertura");
    }
};

module.exports = {
    createTicket,
    verDetalleTicket,
    getTicketsEnEspera,
    getUnidadesDisponibles,
    getTicketsEnSeguimientoSinUnidad,
    asignarUnidadATicket,
    getAllTicketsDashboard,
    actualizarMaps,
    reabrirTicket
};