import './common.js';
import { escapeHtml } from '../shared/dom.js';

interface TechnicianMetrics {
  nombre: string | null;
  tickets_activos: number;
}
interface CalendarEvent {
  id: number | string;
  title: string;
  start: string | null;
}
interface CalendarInteraction {
  event: { id: string; title: string };
  el: HTMLElement;
}
interface CalendarContent {
  event: { title: string };
  timeText: string;
}
// Narrow contracts for the libraries already loaded by the dashboard template.
declare global {
  interface Window {
    Chart?: new (context: CanvasRenderingContext2D, options: Record<string, unknown>) => unknown;
    FullCalendar?: {
      Calendar: new (node: HTMLElement, options: Record<string, unknown>) => { render(): void };
    };
  }
}
const raw = document.getElementById('dashboard-data')?.textContent ?? '{}';
const data = JSON.parse(raw) as { technicians?: TechnicianMetrics[]; events?: CalendarEvent[] };
const canvas = document.getElementById('chartTecnicos');
if (canvas instanceof HTMLCanvasElement && window.Chart) {
  const context = canvas.getContext('2d');
  if (context) {
    const gradient = context.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(67, 24, 255, 0.8)');
    gradient.addColorStop(1, 'rgba(106, 203, 255, 0.2)');
    const technicians = data.technicians ?? [];
    new window.Chart(context, {
      type: 'bar',
      data: {
        labels: technicians.map((technician) => (technician.nombre || 'Sin Asignar').split(' ')[0]),
        datasets: [
          {
            label: 'Tickets Activos',
            data: technicians.map((technician) => technician.tickets_activos),
            backgroundColor: gradient,
            borderColor: 'transparent',
            borderWidth: 0,
            borderRadius: 20,
            barThickness: 25,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: '#e9ecef', borderDash: [5, 5] },
            ticks: { stepSize: 1, color: '#a3aed0', font: { family: "'Poppins', sans-serif" } },
            border: { display: false },
          },
          x: {
            grid: { display: false },
            ticks: { color: '#2b3674', font: { family: "'Poppins', sans-serif", weight: 'bold' } },
            border: { display: false },
          },
        },
      },
    });
  }
}
const calendar = document.getElementById('calendar');
if (calendar && window.FullCalendar) {
  new window.FullCalendar.Calendar(calendar, {
    initialView: 'dayGridMonth',
    eventDisplay: 'block',
    locale: 'es',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,listWeek',
    },
    buttonText: { today: 'Hoy', month: 'Mes', week: 'Semana', list: 'Lista' },
    views: {
      dayGridMonth: { eventDisplay: 'block' },
      timeGridWeek: {
        eventDisplay: 'auto',
        slotEventOverlap: false,
        slotDuration: '00:15:00',
        slotLabelInterval: '01:00',
        eventMinHeight: 40,
        eventContent: (content: CalendarContent) => ({
          html: `<div class="fc-event-main-frame" style="padding: 2px;"><div class="fc-event-title" style="font-weight: bold; font-size: 0.85em;">${escapeHtml(content.event.title)}</div><div class="fc-event-time" style="font-size: 0.75em;">${escapeHtml(content.timeText)}</div></div>`,
        }),
      },
      timeGridDay: { eventDisplay: 'auto', slotEventOverlap: false },
    },
    events: data.events ?? [],
    eventClick: (info: CalendarInteraction) => {
      window.location.href = `/detalle_ticket/${encodeURIComponent(info.event.id)}`;
    },
    eventMouseEnter: (info: CalendarInteraction) => {
      info.el.style.transform = 'scale(1.02)';
      info.el.style.transition = 'transform 0.2s';
    },
    eventMouseLeave: (info: CalendarInteraction) => {
      info.el.style.transform = 'scale(1.0)';
    },
  }).render();
}
