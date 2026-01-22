const { Equipo, Equipo_stock, Unidad,Unidad_Accesorio, sequelize, Ticket } = require('../models/index');
const { Op } = require('sequelize');
const createEquipo = async (data) => {
    return await Equipo.create({
        ID_equipo_modelo: data.id_equipo_modelo,
        IMEI: data.imei,
        ID_modem: data.id_modem
    });
};

const getTiposEquipoStock = async () => {
    return await Equipo_stock.findAll();
};

const getAllEquiposConDetalles = async () => {
    return await Equipo.findAll({
        attributes: ['ID_equipo', 'IMEI', 'ID_modem', 'Estatus_equipo'],
        include: [
            {
                model: Equipo_stock,
                attributes: ['Marca_equipo', 'Modelo_equipo']
            }
        ]
    });
};

const getEquiposEnEspera = async () => {
    return await Equipo.findAll({
        where: {
            Estatus_equipo: 'En espera'
        },
        include: [{
            model: Equipo_stock,
            attributes: ['Marca_equipo', 'Modelo_equipo']
        }]
    });
};

/**
 * Maneja la asignación masiva de EQUIPOS y ACCESORIOS.
 * @param {Object} datosTotales - { equipos: {uid: eid}, accesorios: {uid: [{id, nombre...}]} }
 */
const procesarAsignacionMasiva = async (datosTotales, idTicket) => {
    const t = await sequelize.transaction();
    
    // Desestructuramos lo que viene del front
    const { equipos = {}, accesorios = {} } = datosTotales;
    try {
        const promesas = [];

        // 1. PROCESAR EQUIPOS (Lógica anterior)
        // Iteramos sobre las llaves del objeto equipos { idUnidad: idEquipo }
        const updateEquipos = Object.entries(equipos).map(([unidadId, equipoId]) => {
            return Promise.all([
                // A. Actualizar estatus del equipo a 'Asignado'
                Equipo.update(
                    { Estatus_equipo: 'Asignado' },
                    { where: { ID_equipo: equipoId }, transaction: t }
                ),
                // B. Vincular el equipo a la unidad
                Unidad.update(
                    { ID_equipo: equipoId },
                    { where: { ID_unidad: unidadId }, transaction: t }
                )
            ]);
        });
        promesas.push(...updateEquipos);

        // 2. PROCESAR ACCESORIOS (Nueva Lógica)
        // Iteramos sobre las llaves del objeto accesorios { idUnidad: [arrayDeAccesorios] }
        const updateAccesorios = Object.entries(accesorios).map(([unidadId, listaAccesorios]) => {
            return Promise.all(listaAccesorios.map(acc => {
                
                // === CAMBIO CLAVE: findOrCreate en lugar de create ===
                return Unidad_Accesorio.findOrCreate({
                    where: {
                        ID_unidad: unidadId,
                        ID_accesorio: acc.id 
                    },
                    defaults: {
                        ID_unidad: unidadId,
                        ID_accesorio: acc.id
                    },
                    transaction: t
                });
                
            }));
        });
        promesas.push(...updateAccesorios);

        // Ejecutar TODAS las promesas (Equipos y Accesorios)
        await Promise.all(promesas);
        

        
        const totalUnidades = await Unidad.count({
        where: { ID_ticket: idTicket },
        transaction: t
        });

        // B. Contamos asignados (Los que tienen ID_equipo no nulo)
        const unidadesConEquipo = await Unidad.count({
            where: { 
                ID_ticket: idTicket,
                ID_equipo: { [Op.ne]: null }
            },
            transaction: t
        });

        // C. Determinamos el número de estatus
        let nuevoEstatusNumerico = 0; // Default: Pendiente
        let mensajeEstado = "";

        if (unidadesConEquipo === 0) {
            nuevoEstatusNumerico = 0; // PENDIENTE
            mensajeEstado = "Ninguna unidad asignada aún.";
        } 
        else if (unidadesConEquipo < totalUnidades) {
            nuevoEstatusNumerico = 2; // PARCIAL (OJO: Aquí está el cambio)
            mensajeEstado = `Asignación incompleta (${unidadesConEquipo}/${totalUnidades} unidades).`;
        } 
        else {
            nuevoEstatusNumerico = 1; // COMPLETO (Antes era 1, ahora lo subimos a 2 para diferenciar)
            mensajeEstado = "Ticket completado. Listo para instalación.";
        }

        console.log("Desde asignacion masiva de equipoSErvice:", nuevoEstatusNumerico," y ", mensajeEstado );

        // D. Actualizamos el Ticket con el NÚMERO
        await Ticket.update(
            { Estatus_unidades: nuevoEstatusNumerico }, 
            { where: { ID_ticket: idTicket }, transaction: t }
        );

        await t.commit();
        
        return { 
            success: true, 
            message: mensajeEstado,
            estatusFinal: nuevoEstatusNumerico // Retornamos el número al front
        };

    } catch (error) {
        // Si algo falla, revertimos todo (equipos y accesorios)
        await t.rollback();
        console.error("Rollback ejecutado:", error);
        throw error;
    }
};

const liberarEquipo = async (idUnidad, idEquipo, idTicket) => {
    const t = await sequelize.transaction();

    try {

        // 1. Quitamos el ID_equipo de la Unidad
        await Unidad.update({ ID_equipo: null }, { 
            where: { ID_unidad: idUnidad }, 
            transaction: t 
        });

        // 2. Liberamos el Equipo (Lo ponemos 'En espera')
        await Equipo.update({ Estatus_equipo: 'En espera' }, { 
            where: { ID_equipo: idEquipo }, 
            transaction: t 
        });

        await Ticket.update({ Estatus_unidades: 0 }, { 
            where: { ID_ticket : idTicket }, 
            transaction: t 
        });
        
        await t.commit();
        
        return { success: true, message: "Equipo desvinculado correctamente" };

    } catch (error) {
        await t.rollback();
        console.error("Error en servicio liberarEquipo:", error);
        throw new Error("Error en la transacción de desvinculación"); 
    }
};

const removerAccesorio = async (idUnidad, idAccesorio) => {
    try {
        // Borramos la fila de la tabla intermedia
        // Nota: idAccesorio aquí se refiere al ID del catálogo (stock)
        const filasBorradas = await Unidad_Accesorio.destroy({
            where: {
                ID_unidad: idUnidad,
                ID_accesorio: idAccesorio 
            }
        });

        if (filasBorradas > 0) {
            return { success: true, message: "Accesorio removido correctamente" };
        } else {
            return { success: false, message: "No se encontró la asignación para eliminar" };
        }

    } catch (error) {
        console.error("Error en servicio removerAccesorio:", error);
        throw new Error("Error al intentar eliminar el accesorio de la base de datos");
    }
};

module.exports = {
    createEquipo,
    getTiposEquipoStock,
    getAllEquiposConDetalles,
    getEquiposEnEspera,
    procesarAsignacionMasiva,
    liberarEquipo,
    removerAccesorio
};