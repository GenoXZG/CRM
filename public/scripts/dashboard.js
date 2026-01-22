/* public/js/dashboard.js */

document.addEventListener('DOMContentLoaded', () => {
    
    // Verificamos si existe el elemento canvas y los datos
    const chartCanvas = document.getElementById('chartTecnicos');
    
    if (chartCanvas && window.dashboardData) {
        const ctx = chartCanvas.getContext('2d');
        const dataTecnicos = window.dashboardData; // Leemos los datos inyectados
        
        // Gradiente decorativo
        const gradientFill = ctx.createLinearGradient(0, 0, 0, 400);
        gradientFill.addColorStop(0, 'rgba(67, 24, 255, 0.8)');
        gradientFill.addColorStop(1, 'rgba(106, 203, 255, 0.2)');

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: dataTecnicos.map(t => t.nombre.split(' ')[0]),
                datasets: [{
                    label: 'Tickets Activos',
                    data: dataTecnicos.map(t => t.tickets_activos),
                    backgroundColor: gradientFill,
                    borderColor: 'transparent',
                    borderWidth: 0,
                    borderRadius: 20,
                    barThickness: 25
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: '#e9ecef',
                            borderDash: [5, 5]
                        },
                        ticks: {
                            stepSize: 1,
                            color: '#a3aed0',
                            font: { family: "'Poppins', sans-serif" }
                        },
                        border: { display: false }
                    },
                    x: {
                        grid: { display: false },
                        ticks: {
                             color: '#2b3674',
                             font: { family: "'Poppins', sans-serif", weight: 'bold' }
                        },
                        border: { display: false }
                    }
                }
            }
        });
    }


  
    const calendarEl = document.getElementById('calendar');
    if (calendarEl && window.calendarEvents) {
        const calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            eventDisplay: 'block',
            locale: 'es', 
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,listWeek'
            },
            buttonText: {
                today: 'Hoy',
                month: 'Mes',
                week: 'Semana',
                list: 'Lista'
            },
            views:{
                dayGridMonth: {
                    eventDisplay: 'block' 
                },
                timeGridWeek: {
                    eventDisplay: 'auto',
                    slotEventOverlap: false, 
                    
                    // === NUEVOS AJUSTES ===
                    slotDuration: '00:15:00', 
                    slotLabelInterval: '01:00', 
                    eventMinHeight: 40, 
                    
                 
                    eventContent: function(arg) {
                        return {
                            html: `
                                <div class="fc-event-main-frame" style="padding: 2px;">
                                    <div class="fc-event-title" style="font-weight: bold; font-size: 0.85em;">
                                        ${arg.event.title}
                                    </div>
                                    <div class="fc-event-time" style="font-size: 0.75em;">
                                        ${arg.timeText}
                                    </div>
                                </div>
                            `
                        }
                    }
                },
                timeGridDay: {
                    eventDisplay: 'auto',
                    slotEventOverlap: false // <--- AGREGA ESTO AQUÍ TAMBIÉN
                }
            },
            events: window.calendarEvents, 
            
            // Función al hacer clic en un evento
            eventClick: function(info) {
                // Redirigir al detalle del ticket
                const idTicket = info.event.id;
                // Puedes abrir un modal o redirigir
                window.location.href = `/detalle_ticket/${idTicket}`; 
            },

            // Tooltip simple al pasar el mouse (opcional)
            eventMouseEnter: function(info) {
                info.el.style.transform = "scale(1.02)";
                info.el.style.transition = "transform 0.2s";
            },
            eventMouseLeave: function(info) {
                info.el.style.transform = "scale(1.0)";
            }
        });

        calendar.render();
    }
});