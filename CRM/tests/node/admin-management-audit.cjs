// Dedicated temporary DB inside crm-auth-audit only. No real users or email.
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const args = ['compose', '-p', 'crm-auth-audit', '-f', 'compose.yaml', '-f', 'docker/compose.auth-audit.yaml'];
const name = 'crm_admin_audit_' + Date.now();
function rootSql(sql) {
  return execFileSync('docker', [...args, 'exec', '-T', 'db', 'sh', '-c', 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -u root'], { input: sql, encoding: 'utf8' });
}
const { csrfFetch } = require('./csrf-client.cjs');
const source = csrfFetch.toString() + String.raw`
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const m = require('./dist/infrastructure/database/models');
const { createApplication } = require('./dist/app');
const { passwordHash } = require('./dist/auth');
const { tokenHash } = require('./dist/auth-challenge');
let server, checks = 0, base;
const password = 'Admin-audit-only-2026';
const sql = (query, replacements = [], transaction) => m.database.query(query, { replacements, transaction });
const eq = (a,b,label) => { assert.equal(a,b,label); checks++; };
const user = async id => (await sql('SELECT * FROM usuarios WHERE id=?', [id]))[0][0];
const admins = async () => Number((await sql("SELECT COUNT(*) AS n FROM usuarios WHERE rol='admin'"))[0][0].n);
async function session(id) {
  const token = randomBytes(32).toString('hex');
  await sql('INSERT INTO sesiones_usuario(token_hash,id_usuario,expira_en,segundo_factor) VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 HOUR),1)', [tokenHash(token), id]);
  return 'crm_session=' + token;
}
async function seed(email, role, tech = null) {
  const [id] = await sql('INSERT INTO usuarios(correo,password_hash,rol,id_tecnico) VALUES(?,?,?,?)', [email, await passwordHash(password), role, tech]);
  return id;
}
async function request(path, cookie, body, origin) {
  return csrfFetch(base + path, { redirect: 'manual', method: body ? 'POST' : 'GET', headers: { Accept: 'text/html', ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}), ...(origin ? { Origin: origin } : {}) }, body: body ? new URLSearchParams(body) : undefined });
}
const edit = (id, cookie, email, role = 'admin', extra = {}) => request('/usuarios/' + id + '/editar', cookie, { correo: email, rol: role, password: '', confirmPassword: '', ...extra });
const remove = (id, cookie) => request('/usuarios/' + id + '/eliminar', cookie, {});
const create = (cookie, email, role = 'admin', extra = {}) => request('/usuarios/crear', cookie, { correo: email, rol: role, password, confirmPassword: password, ...extra });
(async () => {
  try {
    const a = await seed('admin-a@example.com', 'admin');
    let ca = await session(a);
    server = createApplication().listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve)); base = 'http://127.0.0.1:' + server.address().port;
    let page = await request('/usuarios', ca), html = await page.text();
    eq(page.status, 200, 'admin screen');
    eq(html.includes('Último administrador'), true, 'last admin labeled');
    eq(html.includes('/usuarios/' + a + '/editar'), true, 'last admin editable');
    eq(html.includes('/usuarios/' + a + '/eliminar'), false, 'self-delete absent');
    eq((await edit(a, ca, 'admin-a@example.com', 'coordinador')).status, 409, 'cannot demote last admin');
    eq((await remove(a, ca)).status, 409, 'cannot remove last admin');
    eq(await admins(), 1, 'at least one admin retained');
    const priorHash = (await user(a)).password_hash;
    eq((await edit(a, ca, 'admin-a@example.com')).headers.get('location'), '/login', 'own edit returns to login');
    eq((await user(a)).password_hash, priorHash, 'blank password preserved');
    eq((await request('/usuarios', ca)).status, 302, 'own session revoked'); ca = await session(a);
    eq((await create(ca, 'admin-b@example.com')).status, 302, 'create administrator');
    const b = (await sql('SELECT id FROM usuarios WHERE correo=?', ['admin-b@example.com']))[0][0].id;
    let cb = await session(b);
    eq((await request('/usuarios', cb)).status, 200, 'new admin access');
    eq((await user(b)).id_tecnico, null, 'admin has no technician link');
    eq((await user(b)).password_hash.startsWith('scrypt:'), true, 'admin password hashed');
    eq((await create(ca, 'admin-b@example.com')).status, 409, 'duplicate email');
    eq((await create(ca, 'invalid@example.com', 'root')).status, 400, 'unknown role');
    eq((await create(ca, 'short@example.com', 'admin', { password: 'short', confirmPassword: 'short' })).status, 400, 'password length');
    eq((await create(ca, 'confirm@example.com', 'admin', { confirmPassword: 'different' })).status, 400, 'confirmation');
    eq((await create(null, 'anon@example.com')).status, 401, 'anonymous cannot create admin');
    const coord = await seed('coord@example.com', 'coordinador'), cc = await session(coord);
    const tech = await m.technicianModel.create({ Nombre_tecnico: 'Admin audit tech', Numero_tecnico: '5512345678', Estatus_tecnico: 'Activo' });
    const technician = await seed('tech@example.com', 'tecnico', tech.ID_Tecnico), ct = await session(technician);
    for (const cookie of [cc, ct]) {
      eq((await create(cookie, 'forbidden@example.com')).status, 403, 'non-admin cannot create admin');
      eq((await edit(b, cookie, 'changed@example.com')).status, 403, 'non-admin cannot edit admin');
      eq((await remove(b, cookie)).status, 403, 'non-admin cannot delete admin');
    }
    eq((await request('/usuarios/crear', ca, { correo: 'origin@example.com', rol: 'admin', password, confirmPassword: password }, 'https://evil.example')).status, 403, 'cross-origin denied');
    eq((await remove(a, ca)).status, 409, 'cannot self-delete even with other admin');
    eq(await admins(), 2, 'self-delete preserves both admins');
    // Promote an existing technician; release its catalog link and revoke all credentials.
    for (const table of ['desafios_login', 'recuperaciones_password']) await sql('INSERT INTO ' + table + '(token_hash,id_usuario,code_hash,credential_hash,creado_en,expira_en) VALUES(?,?,?,?,UTC_TIMESTAMP(),DATE_ADD(UTC_TIMESTAMP(),INTERVAL 5 MINUTE))', [randomBytes(32).toString('hex'), technician, '1'.repeat(64), '2'.repeat(64)]);
    eq((await edit(technician, ca, 'tech@example.com')).status, 302, 'promote technician');
    eq((await user(technician)).id_tecnico, null, 'promotion releases technician link');
    for (const table of ['sesiones_usuario', 'desafios_login', 'recuperaciones_password']) eq(Number((await sql('SELECT COUNT(*) AS n FROM ' + table + ' WHERE id_usuario=?', [technician]))[0][0].n), 0, table + ' revoked after promotion');
    eq((await request('/usuarios', ct)).status, 302, 'old technical session revoked');
    const promoted = await session(technician);
    eq((await request('/usuarios', promoted)).status, 200, 'promoted admin access');
    eq((await edit(technician, ca, 'tech@example.com', 'tecnico', { id_tecnico: String(tech.ID_Tecnico) })).status, 302, 'demote back to linked technician');
    eq((await user(technician)).id_tecnico, tech.ID_Tecnico, 'technician link restored');
    eq((await request('/usuarios', promoted)).status, 302, 'promotion session revoked on demotion');
    eq((await edit(b, ca, 'admin-renamed@example.com', 'admin', { password: 'New-admin-password-2026', confirmPassword: 'New-admin-password-2026' })).status, 302, 'edit another admin email and password');
    eq((await user(b)).correo, 'admin-renamed@example.com', 'email saved');
    eq((await request('/usuarios', cb)).status, 302, 'edited admin session revoked'); cb = await session(b);
    // Two simultaneous self-demotions can never leave zero admins.
    const statuses = await Promise.all([edit(a, ca, 'admin-a@example.com', 'coordinador'), edit(b, cb, 'admin-renamed@example.com', 'coordinador')]);
    eq(statuses.filter(r => r.status === 302).length, 1, 'one concurrent demotion succeeds');
    eq(statuses.filter(r => r.status === 409).length, 1, 'last concurrent demotion rejected');
    eq(await admins(), 1, 'concurrent demotions retain administrator');
    await sql("UPDATE usuarios SET rol='admin' WHERE id IN (?,?)", [a,b]); ca = await session(a); cb = await session(b);
    // Requests already past middleware must recheck role and session under lock.
    async function staleActor(revokeSession) {
      let release, reached;
      const gate = new Promise(resolve => { release = resolve; }), entered = new Promise(resolve => { reached = resolve; });
      const original = m.database.query;
      let intercepted = false;
      m.database.query = async function(statement, options) {
        if (!intercepted && statement === 'SELECT id,rol FROM usuarios ORDER BY id FOR UPDATE') { intercepted = true; reached(); await gate; }
        return original.call(this, statement, options);
      };
      const pending = create(cb, revokeSession ? 'stale-session@example.com' : 'stale-role@example.com');
      try {
        await entered;
        if (revokeSession) await sql('DELETE FROM sesiones_usuario WHERE id_usuario=?', [b]);
        else await sql("UPDATE usuarios SET rol='coordinador' WHERE id=?", [b]);
        release(); eq((await pending).status, 401, 'in-flight stale ' + (revokeSession ? 'session' : 'role') + ' rejected');
      } finally { release(); m.database.query = original; }
      await sql("UPDATE usuarios SET rol='admin' WHERE id=?", [b]); cb = await session(b);
    }
    await staleActor(false); await staleActor(true);
    eq(Number((await sql("SELECT COUNT(*) AS n FROM usuarios WHERE correo LIKE 'stale-%'"))[0][0].n), 0, 'stale admin cannot create accounts');
    // Concurrent mutual deletion: the second actor loses permission after first commits.
    const deleted = await Promise.all([remove(b, ca), remove(a, cb)]);
    eq(deleted.filter(r => r.status === 302).length, 1, 'one concurrent deletion');
    eq(deleted.some(r => r.status === 401 || r.status === 403), true, 'removed actor denied');
    eq(await admins(), 1, 'mutual deletion retains admin');
    const last = (await sql("SELECT id,correo FROM usuarios WHERE rol='admin'"))[0][0], lastCookie = await session(last.id);
    eq((await remove(last.id, lastCookie)).status, 409, 'final admin remains protected');
    console.log('PASS ' + checks + ' checks: admin lifecycle, roles, last-admin invariant, session revocation and concurrent/stale requests');
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await m.database.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
`;
let created = false;
try {
  rootSql('CREATE DATABASE `' + name + '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;');
  created = true;
  rootSql('GRANT ALL ON `' + name + "`.* TO 'crm'@'%';");
  rootSql('USE `' + name + '`;\n' + fs.readFileSync('docker/mysql/init/001-schema.sql', 'utf8'));
  execFileSync('docker', [...args, 'exec', '-T', '-e', 'DB_NAME=' + name, 'app', 'node'], { encoding: 'utf8', input: source, stdio: ['pipe', 'inherit', 'inherit'] });
} finally {
  if (created) rootSql('DROP DATABASE `' + name + '`;');
}
