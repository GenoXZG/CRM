import http from 'k6/http';
import { check, fail } from 'k6';

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: { checks: ['rate==1'], http_req_failed: ['rate==0'] },
};
const baseUrl = (__ENV.BASE_URL || 'http://127.0.0.1:3030').replace(/\/$/, '');
const ticketId = encodeURIComponent(__ENV.TICKET_ID || '2');
const pages = ["/?view=month&date=2030-05-15", "/?view=day&date=2030-05-15", "/tickets?attention=overdue", "/tickets?attention=unassigned", "/tickets?attention=incomplete", "/directorio", "/directorio?clients_size=5&technicians_size=10&technicians_status=active", "/", "/clientes", "/tecnicos", "/tickets", "/tickets/nuevo", "/estado_tickets", "/equipos", "/unidades", "/accesorios", "/inventario", "/registro_equipos", "/asignaciones", "/asignacion_unidades", "/asignacion_equipos", `/detalle_ticket/${ticketId}`];
const modules = ["shared/location-map.js", "shared/location-coordinates.js","pages/directory.js", "pages/ticket-list.js", "pages/assignments.js", "pages/common.js", "pages/dashboard.js", "pages/equipment-assignment.js", "pages/equipment-registration.js", "pages/ticket-details.js", "pages/ticket-form.js", "pages/unit-assignment.js", "shared/bootstrap.js", "shared/dialogs.js", "shared/dom.js", "shared/http.js", "shared/unit-removal.js", "shared/equipment-registration.js", "shared/assignment-workspace.js", "state/equipment-assignment.js"];

function get(path, contentType) {
  const response = http.get(`${baseUrl}${path}`);
  check(response, {
    [`${path}: HTTP 200`]: result => result.status === 200,
    [`${path}: content type`]: result => String(result.headers['Content-Type']).includes(contentType),
  });
  return response;
}
function jsonArray(response, label) {
  try {
    const value = response.json();
    check(value, { [`${label}: array`]: result => Array.isArray(result) });
    return Array.isArray(value) ? value : [];
  } catch {
    check(false, { [`${label}: valid JSON`]: result => result });
    return [];
  }
}
export function setup() {
  if (!__ENV.CRM_SESSION) fail('Configura CRM_SESSION con una sesión obtenida después de verificar el código por correo.');
  return { cookie: __ENV.CRM_SESSION };
}
export default function (session) {
  http.cookieJar().set(baseUrl, 'crm_session', session.cookie);
  const health = get('/health', 'application/json');
  check(health, { 'Database available': response => response.json('status') === 'ok' });
  for (const page of pages) {
    const response = get(page, 'text/html');
    check(response, { [`${page}: HTML page`]: result => String(result.body).includes('<html') });
    if (page === '/' || page.startsWith('/?')) check(response, {
      [`${page}: dashboard operativo`]: result => ['id="attention-title"', 'id="agenda-title"', 'id="workload-title"', 'id="stock-title"', '/tickets#nuevo-ticket'].every(marker => String(result.body).includes(marker)),
      [`${page}: indicador histórico correcto`]: result => !String(result.body).includes('Finalizados Hoy'),
    });
    if (page.startsWith('/detalle_ticket/')) check(response, {
      [`${page}: historial disponible`]: result => String(result.body).includes('id="ticket-history"') && String(result.body).includes('id="ticket-history-size"'),
    });
    if (page === '/tickets' || page === '/estado_tickets') check(response, {
      [`${page}: creación integrada`]: result => ['id="ticket-create-panel"', 'id="ticket-create-form"', 'data-embedded="true"', 'id="ticket-create-back"'].every(marker => String(result.body).includes(marker)),
    });
    if (page.startsWith('/directorio') || page === '/clientes' || page === '/tecnicos') check(response, {
      [`${page}: directorio unificado`]: result => ['id="clients"', 'id="technicians"', 'id="clients-size"', 'id="technicians-size"', 'id="technicians-status"'].every(marker => String(result.body).includes(marker)),
    });
  }
  jsonArray(get('/equipos_espera', 'application/json'), 'Equipment');
  jsonArray(get(`/unidades-por-ticket/${ticketId}`, 'application/json'), 'Units');
  const brands = jsonArray(get('/test', 'application/json'), 'Brands');
  check(brands, { 'Brand available for model lookup': result => result.length > 0 });
  if (brands.length) jsonArray(get(`/modelos?marca=${encodeURIComponent(brands[0].Marca_unidad)}`, 'application/json'), 'Models');
  for (const module of modules) get(`/assets/${module}`, 'javascript');
  for (const stylesheet of ['/css/dashboard-operations.css', '/css/ticket-form.css', '/css/location-map.css', '/leaflet/leaflet.css', '/css/directory.css', '/css/inventory.css', '/css/ticket-list.css', '/css/ticket-workspace.css', '/css/assignments.css', '/css/styles.css', '/css/dashboard.css', '/bootstrap/css/bootstrap.min.css']) get(stylesheet, 'text/css');
  get('/bootstrap/js/bootstrap.bundle.min.js', 'javascript');
  get('/leaflet/leaflet.js', 'javascript');
  // Resolving an explicit coordinate URL is read-only and needs no external request.
  const csrfToken = get('/csrf-token', 'application/json').json('token');
  const location = http.post(`${baseUrl}/tickets/resolver_ubicacion`, JSON.stringify({ url: 'https://www.google.com/maps/search/19.406313,+-99.046890' }), { headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken } });
  check(location, {
    'Map link: HTTP 200': result => result.status === 200,
    'Map link: coordinates': result => result.json('data.lat') === 19.406313 && result.json('data.lng') === -99.04689,
    'Map link: normalized URL': result => result.json('data.normalizedUrl') === 'https://www.google.com/maps?q=19.406313,-99.046890',
  });
}

export function teardown(session) {
  if (!session?.cookie) return;
  http.cookieJar().set(baseUrl, 'crm_session', session.cookie);
  const csrfToken = http.get(`${baseUrl}/csrf-token`).json('token');
  http.post(`${baseUrl}/logout`, {}, { headers: { 'X-CSRF-Token': csrfToken }, redirects: 0 });
}
