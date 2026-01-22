const { Unidad, Ticket, Unidad_catalogo,Equipo,Accesorio_stock,Equipo_stock, sequelize } = require('../models/index');

/**
 * Crea múltiples unidades y actualiza el estatus del ticket asociado.
 * Todo dentro de una transacción atómica.
 */
const createUnidadesAndStartTicket = async (listaUnidades, ticketId) => {
    const t = await sequelize.transaction();

    try {
        // 1. Crear todas las unidades
        // Usamos map para preparar las promesas de creación
        const creationPromises = listaUnidades.map(unidad => 
            Unidad.create({
                ID_Unidad_modelo: unidad.modelo,
                Placa_unidad: unidad.placa,
                Vin_unidad: unidad.vin,
                ID_ticket: unidad.ticketId, // Aseguramos que se vinculen al ticket
            }, { transaction: t }) // IMPORTANTE: Pasamos la transacción
        );

        const resultados = await Promise.all(creationPromises);

        // 2. Actualizar el estatus del Ticket
        await Ticket.update(
            { Estatus_servicio: 'En seguimiento' },
            { 
                where: { ID_ticket: ticketId },
                transaction: t 
            }
        );

        // Si todo salió bien, confirmamos los cambios en la BD
        await t.commit();
        
        return resultados;

    } catch (error) {
        // Si algo falla, deshacemos TODO (incluso las unidades que se hubieran creado)
        await t.rollback();
        throw error;
    }
};

const getUnidadesByTicketId = async (idTicket) => {
    return await Unidad.findAll({
        // Agregamos 'ID_equipo' por si lo necesitas validar directamente
        attributes: ['ID_Unidad', 'Placa_unidad', 'Vin_unidad', 'ID_equipo'], 
        where: { ID_ticket: idTicket },
        include: [
            {
                model: Ticket,
                attributes: ['ID_ticket', 'Tipo_servicio', 'Estatus_servicio', 'Fecha_servicio']
            },
            {
                // Mantenemos tu modelo actual (sea Unidad_catalogo o Unidad_stock)
                model: Unidad_catalogo, 
                attributes: ['Marca_unidad', 'Modelo_unidad']
            },
            
            // --- NUEVO: Traer el GPS asignado ---
            {
                model: Equipo,
                required: false, 
                include: [{
                    model: Equipo_stock, 
                    attributes: ['Modelo_equipo', 'Marca_equipo']
                }]
            },

            // --- NUEVO: Traer los Accesorios asignados ---
            {
                model: Accesorio_stock, // Asegúrate de que este sea el nombre correcto de tu modelo importado
                required: false,
                attributes: ['ID_accesorio_modelo', 'Nombre_accesorio'], // Los datos que usa tu JS
                through: { attributes: [] } // No traer datos de la tabla intermedia
            }
        ]
    });
};

module.exports = {
    createUnidadesAndStartTicket,
    getUnidadesByTicketId
};