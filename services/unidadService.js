const { Unidad, Ticket, Unidad_catalogo,Equipo,Accesorio_stock,Equipo_stock, sequelize } = require('../models/index');

const createUnidadesAndStartTicket = async (listaUnidades, ticketId) => {
    const t = await sequelize.transaction();

    try {
        const creationPromises = listaUnidades.map(unidad => 
            Unidad.create({
                ID_Unidad_modelo: unidad.modelo,
                Placa_unidad: unidad.placa,
                Vin_unidad: unidad.vin,
                ID_ticket: unidad.ticketId, 
            }, { transaction: t }) 
        );

        const resultados = await Promise.all(creationPromises);

        await Ticket.update(
            { Estatus_servicio: 'En seguimiento' },
            { 
                where: { ID_ticket: ticketId },
                transaction: t 
            }
        );

        await t.commit();
        
        return resultados;

    } catch (error) {
        await t.rollback();
        throw error;
    }
};

const getUnidadesByTicketId = async (idTicket) => {
    return await Unidad.findAll({
        attributes: ['ID_Unidad', 'Placa_unidad', 'Vin_unidad', 'ID_equipo'], 
        where: { ID_ticket: idTicket },
        include: [
            {
                model: Ticket,
                attributes: ['ID_ticket', 'Tipo_servicio', 'Estatus_servicio', 'Fecha_servicio']
            },
            {
               
                model: Unidad_catalogo, 
                attributes: ['Marca_unidad', 'Modelo_unidad']
            },
            
            {
                model: Equipo,
                required: false, 
                include: [{
                    model: Equipo_stock, 
                    attributes: ['Modelo_equipo', 'Marca_equipo']
                }]
            },

           
            {
                model: Accesorio_stock, 
                required: false,
                attributes: ['ID_accesorio_modelo', 'Nombre_accesorio'], 
                through: { attributes: [] } 
            }
        ]
    });
};

module.exports = {
    createUnidadesAndStartTicket,
    getUnidadesByTicketId
};
