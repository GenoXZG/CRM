// Integration audit: isolated crm-auth-audit only. No real email or production data.
const { execFileSync } = require('node:child_process');
const source = String.raw`
const assert = require('node:assert/strict');
const { randomBytes, createHash } = require('node:crypto');
const m = require('./dist/infrastructure/database/models');
const { csvCell } = require('./dist/adapters/ticket-csv');
const marker = 'export_' + Date.now();
const base = 'http://127.0.0.1:3030';
let client, techA, techB, checks = 0;
const users = [], cookies = {};
const eq = (a, b, message) => { assert.equal(a, b, message); checks++; };
function parseCsv(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && c === ',') { row.push(cell); cell = ''; }
    else if (!quoted && c === '\r' && text[i + 1] === '\n') {
      row.push(cell); rows.push(row); row = []; cell = ''; i++;
    } else cell += c;
  }
  return rows;
}
async function request(params, role = 'admin') {
  return fetch(base + '/tickets/exportar?' + new URLSearchParams({ search: marker, ...params }), {
    redirect: 'manual', headers: role ? { Cookie: cookies[role], Accept: 'application/json' } : {},
  });
}
async function rows(params, role) {
  const r = await request(params, role); eq(r.status, 200, 'download status');
  eq(r.headers.get('content-type').includes('text/csv'), true, 'CSV MIME');
  eq(r.headers.get('content-disposition').includes('.csv'), true, 'attachment');
  return parseCsv(await r.text());
}
(async () => {
  try {
    eq(csvCell('=SUM(1,2)'), '"\'=SUM(1,2)"', 'formula neutralized');
    eq(csvCell(' \t@command'), '"\' \t@command"', 'leading whitespace formula');
    eq(csvCell('a,"b"\nc'), '"a,""b""\nc"', 'CSV escaping');
    eq(csvCell(null), '""', 'null');
    client = await m.clientModel.create({ Nombre_empresa: marker + ' Álvarez, "México"', Encargado: 'QA', Numero: '5512345678' });
    techA = await m.technicianModel.create({ Nombre_tecnico: marker + ' A', Estatus_tecnico: 'Activo', Numero_tecnico: '5512345678' });
    techB = await m.technicianModel.create({ Nombre_tecnico: marker + ' B', Estatus_tecnico: 'Activo', Numero_tecnico: '5512345678' });
    for (const role of ['admin', 'coordinador', 'tecnico']) {
      const [id] = await m.database.query('INSERT INTO usuarios(correo,password_hash,rol,id_tecnico) VALUES(?,?,?,?)', { replacements: [marker + role + '@example.com', 'audit-unused-password', role, role === 'tecnico' ? techA.ID_Tecnico : null] });
      users.push(id);
      const token = randomBytes(32).toString('hex');
      await m.database.query('INSERT INTO sesiones_usuario(token_hash,id_usuario,expira_en,segundo_factor) VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 HOUR),1)', { replacements: [createHash('sha256').update(token).digest('hex'), id] });
      cookies[role] = 'crm_session=' + token;
    }
    await m.ticketModel.bulkCreate(Array.from({ length: 505 }, (_, i) => ({
      ID_cliente: client.ID_cliente, ID_tecnico: i < 501 ? techA.ID_Tecnico : i < 504 ? techB.ID_Tecnico : null,
      Tipo_servicio: 'Instalacion', Estatus_servicio: i === 0 ? 'Finalizado' : 'En espera', Numero_unidades: 1,
      Fecha_servicio: new Date(i === 0 ? '2030-05-21T12:34:00Z' : '2030-05-20T12:00:00Z'),
      Fecha_cierre: i === 0 ? new Date('2030-05-22T18:30:00Z') : null,
      Comentarios: i === 0 ? '=SUM(1,2)\nSegunda línea "México"' : null,
    })));
    let data = await rows({ size: '5', page: '99' });
    eq(data.length, 506, 'all results beyond page and 500-row batch');
    eq(new Set(data.slice(1).map(row => row[0])).size, 505, 'no repeated tickets');
    eq(data.every(row => row.length === 11), true, 'consistent column count');
    eq(data[1][1], client.Nombre_empresa, 'accents, commas and quotes');
    eq(Number(data[1][0]) > Number(data.at(-1)[0]), true, 'descending IDs');
    data = await rows({ status: 'completed', dateFrom: '2030-05-21', dateTo: '2030-05-21' });
    eq(data.length, 2, 'combined date/status filters');
    eq(data[1][7], '2030-05-21 12:34:00', 'captured service time');
    eq(data[1][8], '2030-05-22 12:30:00', 'Mexico City closure time');
    eq(data[1][10], "'=SUM(1,2)\nSegunda línea \"México\"", 'formula neutralized and multiline intact');
    eq((await rows({}, 'coordinador')).length, 506, 'coordinator access');
    eq((await rows({}, 'tecnico')).length, 502, 'technician own tickets across batches');
    eq((await rows({ technician: String(techB.ID_Tecnico) }, 'tecnico')).length, 502, 'cannot override technician scope');
    eq((await rows({ attention: 'unassigned' }, 'tecnico')).length, 1, 'technician cannot see unassigned');
    eq((await rows({ attention: 'unassigned' })).length, 2, 'unassigned filter');
    eq((await rows({ attention: 'incomplete' })).length, 505, 'incomplete excludes completed');
    eq((await rows({ search: marker + '_missing' })).length, 1, 'empty export contains headers');
    eq((await request({ status: 'invalid' })).status, 400, 'reject invalid filters');
    eq((await request({ dateFrom: '2030-05-22', dateTo: '2030-05-20' })).status, 400, 'reject inverted dates');
    eq((await request({}, null)).status, 302, 'authentication required');
    const page = await fetch(base + '/tickets?search=' + marker, { headers: { Cookie: cookies.tecnico } });
    eq((await page.text()).includes('/tickets/exportar?'), true, 'export action rendered for technician');
    console.log('PASS ' + checks + ' checks: CSV, batch export, filters, dates, authentication and role scope');
  } finally {
    if (client) await m.ticketModel.destroy({ where: { ID_cliente: client.ID_cliente } });
    if (users.length) await m.database.query('DELETE FROM usuarios WHERE id IN (?)', { replacements: [users] });
    if (client) await client.destroy();
    if (techA) await techA.destroy();
    if (techB) await techB.destroy();
    await m.database.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
`;
execFileSync('docker', ['compose', '-p', 'crm-auth-audit', '-f', 'compose.yaml', '-f', 'docker/compose.auth-audit.yaml', 'exec', '-T', 'app', 'node'], { encoding: 'utf8', input: source, stdio: ['pipe', 'inherit', 'inherit'] });
