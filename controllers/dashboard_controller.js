const dashboardService = require('../services/dashboardService');

const viewDashboard = async (req, res) => {
    try {
        // Ejecutamos ambas consultas en paralelo para ser más rápidos
        const [metrics, calendarEvents] = await Promise.all([
            dashboardService.getDashboardMetrics(),
            dashboardService.getCalendarEvents()
        ]);

        res.render('index', { metrics, calendarEvents });
    } catch (error) {
        console.error("Error cargando dashboard:", error);
        res.render('index', { metrics: null, calendarEvents: [], error: 'Error' });
    }
};

module.exports = { viewDashboard };