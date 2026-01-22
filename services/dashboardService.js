const { Ticket, Tecnico, Equipo, Equipo_stock, sequelize } = require('../models/index');
const { Op } = require('sequelize');

const getDashboardMetrics = async () => {
    
    //  Tarjetas Superiores 
    const totalTickets = await Ticket.count();
    
    const ticketsPorEstatus = await Ticket.findAll({
        attributes: ['Estatus_servicio', [sequelize.fn('COUNT', sequelize.col('Estatus_servicio')), 'cantidad']],
        group: ['Estatus_servicio'],
        raw: true
    });

    const counts = {
        espera: 0,
        seguimiento: 0,
        finalizado: 0
    };

    ticketsPorEstatus.forEach(item => {
        if(item.Estatus_servicio === 'En espera') counts.espera = item.cantidad;
        if(item.Estatus_servicio === 'En seguimiento') counts.seguimiento = item.cantidad;
        if(item.Estatus_servicio === 'Finalizado') counts.finalizado = item.cantidad;
    });

    // Gráfico: Top 5 Técnicos con más trabajo activo
    const topTecnicos = await Ticket.findAll({
        where: { Estatus_servicio: { [Op.ne]: 'Finalizado' } },
        attributes: [
            [sequelize.col('Tecnico.Nombre_tecnico'), 'nombre'],
            [sequelize.fn('COUNT', sequelize.col('Ticket.ID_ticket')), 'tickets_activos']
        ],
        include: [{ model: Tecnico, attributes: [] }], 
        group: ['Tecnico.Nombre_tecnico'],
        order: [[sequelize.literal('tickets_activos'), 'DESC']],
        limit: 5,
        raw: true
    });

    const equiposStockBajo = await Equipo_stock.findAll({
        attributes: [
            'Modelo_equipo',
            [sequelize.literal(`(
                SELECT COUNT(*)
                FROM Equipos AS e
                WHERE e.ID_equipo_modelo = Equipo_stock.ID_equipo_modelo
                AND e.Estatus_equipo = 'En espera'
            )`), 'disponibles']
        ],
        order: [[sequelize.literal('disponibles'), 'ASC']],
        limit: 5
    });

    return {
        totalTickets,
        counts,
        topTecnicos,
        equiposStockBajo
    };
};

const getCalendarEvents = async () => {
    const tickets = await Ticket.findAll({
        attributes: ['ID_ticket', 'Tipo_servicio', 'Fecha_servicio', 'Estatus_servicio'],
        raw: true
    });
    return tickets.map(ticket => {

        const estatus = ticket.Estatus_servicio;
        
        
        if (estatus === 'En espera') {
            color = '#fff5cc'; 
            textColor = '#d9a600';
        } else if (estatus=== 'En seguimiento') {
            color = '#dbeafe'; 
            textColor = '#1e40af';
        } else if (estatus === 'Finalizado') {
             color = '#d1fae5'; 
             textColor = '#065f46';
        }

        return {
            id: ticket.ID_ticket,
            title: `#${ticket.ID_ticket} - ${ticket.Tipo_servicio}`,
            start: ticket.Fecha_servicio, 
            backgroundColor: color,
            borderColor: 'transparent',
            textColor: textColor,
            status: ticket.Estatus_servicio 
        };
    });
};

module.exports = {
    getDashboardMetrics,
    getCalendarEvents
};
