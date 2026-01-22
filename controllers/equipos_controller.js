const equipoService = require('../services/equipoService');
const ticketService = require('../services/ticketService');

const agregarEquipo = async (req, res) => {
    try {
        await equipoService.createEquipo(req.body);
        res.redirect('/registro_equipos');
    } catch (error) {
        console.error('Error al agregar equipo:', error);
        res.status(500).send('Error al registrar el equipo');
    }
};

const viewRegistroEquipos = async (req, res) => { // Renombrado de equiposAsignados
    try {
        // Ejecución en paralelo para velocidad
        const [equipos_stock, equiposAsignados] = await Promise.all([
            equipoService.getTiposEquipoStock(),
            equipoService.getAllEquiposConDetalles()
        ]);

        res.render('registro_equipos', { 
            equipos_stock, 
            equiposAsignados 
        });
    } catch (error) {
        console.error('Error al obtener datos de equipos:', error);
        res.status(500).send('Error interno del servidor');
    }
};

const apiEquiposEnEspera = async (req, res) => { 
    try {
        const equipos = await equipoService.getEquiposEnEspera();
        res.json(equipos); 
    } catch (error) {
        console.error('Error al obtener equipos en espera:', error);
        res.status(500).json({ error: 'Error al obtener datos' });
    }
};

const realizarAsignacionMasiva = async (req, res) => {
    const { datosAsignacion, idTicket } = req.body; 
    if (!datosAsignacion|| Object.keys(datosAsignacion).length === 0) {
        return res.status(400).json({ error: "No hay asignaciones para procesar" });
    }
    try {
        const resultado = await equipoService.procesarAsignacionMasiva(datosAsignacion, idTicket);
        // if (idTicket) {
        //     await ticketService.asignarUnidadATicket(idTicket);
            
        // }

        res.json({ 
            success: true, 
            message: "Equipos asignados y ticket actualizado correctamente",
            resultado 
        });

    } catch (error) {
        console.error("Error en asignación masiva:", error);
        res.status(500).json({ success: false, error: "Fallo en la transacción de asignación" });
    }
};

const desvincularEquipo = async (req, res) => {
  
    const { idUnidad, idEquipo, idTicket } = req.body;

    if (!idUnidad || !idEquipo || !idTicket) {
        return res.status(400).json({ 
            success: false, 
            message: "Faltan datos requeridos (idUnidad, idEquipo, idTicket)" 
        });
    }

    try {
        // 3. Pasamos los 3 parámetros al servicio
        const resultado = await equipoService.liberarEquipo(idUnidad, idEquipo, idTicket);
        
        res.json(resultado);

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Error interno al desvincular equipo" });
    }
};

const desvincularAccesorio = async (req, res) => {
    
    const { idUnidad, idAccesorio } = req.body;

    if (!idUnidad || !idAccesorio) {
        return res.status(400).json({ success: false, message: "Faltan datos requeridos accesorio" });
    }

    try {
    
        const resultado = await equipoService.removerAccesorio(idUnidad, idAccesorio);


        res.json(resultado);

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Error interno al remover accesorio" });
    }
};


module.exports = {
    agregarEquipo,
    viewRegistroEquipos,      // Antes equiposAsignados
    apiEquiposEnEspera,       // Antes equiposEnEspera
    realizarAsignacionMasiva, // Antes asignarEquipos
    desvincularEquipo,
    desvincularAccesorio 
};