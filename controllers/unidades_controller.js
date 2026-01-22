const unidadService = require('../services/unidadService');

const agregarUnidades = async (req, res) => {
    const { unidades } = req.body;

    // Validación básica de entrada
    if (!unidades || unidades.length === 0) {
        return res.status(400).json({ success: false, message: "No se enviaron unidades." });
    }

    // Asumimos que todas las unidades del array pertenecen al mismo ticket (basado en tu código original)
    const ID_ticket = unidades[0].ticketId;

    try {
        const resultados = await unidadService.createUnidadesAndStartTicket(unidades, ID_ticket);
        
        res.json({ 
            success: true,
            message: 'Unidades registradas y ticket actualizado correctamente',
            unidadesCreadas: resultados.length,
            data: resultados 
        });

    } catch (error) {
        console.error('Error en agregarUnidades:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al procesar la solicitud',
            error: error.message // Ojo: En producción evita enviar error.message crudo al cliente por seguridad
        });
    }
};

const apiObtenerUnidadesTicket = async (req, res) => {
    const { id_ticket } = req.params; 

    try {
        const unidades = await unidadService.getUnidadesByTicketId(id_ticket);
        
        if (!unidades) {
            return res.status(404).json({ success: false, message: 'No se encontraron unidades' });
        }

        res.json(unidades);
    } catch (error) {
        console.error('Error al obtener unidades:', error);
        res.status(500).json({ success: false, message: 'Error interno' });
    }
};

module.exports = {
    agregarUnidades,
    apiObtenerUnidadesTicket
};