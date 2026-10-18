import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: { checks: ['rate==1'], http_req_failed: ['rate==0'] },
};
const baseUrl = (__ENV.BASE_URL || 'http://127.0.0.1:3030').replace(/\/$/, '');
const ticketId = encodeURIComponent(__ENV.TICKET_ID || '2');
const pages = ["/", "/clientes", "/tecnicos", "/tickets", "/estado_tickets", "/equipos", "/unidades", "/accesorios", "/registro_equipos", "/asignacion_unidades", "/asignacion_equipos", `/detalle_ticket/${ticketId}`];
const modules = ["pages/common.js", "pages/dashboard.js", "pages/equipment-assignment.js", "pages/equipment-registration.js", "pages/ticket-details.js", "pages/ticket-form.js", "pages/unit-assignment.js", "shared/bootstrap.js", "shared/dialogs.js", "shared/dom.js", "shared/http.js", "state/equipment-assignment.js"];

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
export default function () {
  const health = get('/health', 'application/json');
  check(health, { 'Database available': response => response.json('status') === 'ok' });
  for (const page of pages) {
    const response = get(page, 'text/html');
    check(response, { [`${page}: HTML page`]: result => String(result.body).includes('<html') });
  }
  jsonArray(get('/equipos_espera', 'application/json'), 'Equipment');
  jsonArray(get(`/unidades-por-ticket/${ticketId}`, 'application/json'), 'Units');
  const brands = jsonArray(get('/test', 'application/json'), 'Brands');
  check(brands, { 'Brand available for model lookup': result => result.length > 0 });
  if (brands.length) jsonArray(get(`/modelos?marca=${encodeURIComponent(brands[0].Marca_unidad)}`, 'application/json'), 'Models');
  for (const module of modules) get(`/assets/${module}`, 'javascript');
  for (const stylesheet of ['/css/styles.css', '/css/dashboard.css', '/bootstrap/css/bootstrap.min.css']) get(stylesheet, 'text/css');
  get('/bootstrap/js/bootstrap.bundle.min.js', 'javascript');
}
