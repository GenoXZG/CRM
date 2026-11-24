const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

const base = 'http://127.0.0.1:3031';
const args = ['compose', '-p', 'crm-auth-audit', '-f', 'compose.yaml', '-f', 'docker/compose.auth-audit.yaml'];
const auth = {};
function cookieHeaders(response) {
  for (const value of response.headers.getSetCookie()) {
    const [cookie] = value.split(';');
    const separator = cookie.indexOf('=');
    const name = cookie.slice(0, separator);
    if (cookie.endsWith('=')) delete auth[name];
    else auth[name] = cookie;
  }
}

function request(path, { body, token, cookie = Object.values(auth).join('; '), headers } = {}) {
  return fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    redirect: 'manual',
    headers: { Cookie: cookie, ...(token ? { 'X-CSRF-Token': token } : {}), ...headers },
    body: body === undefined ? undefined : new URLSearchParams(body),
  });
}

async function state(path) {
  const response = await request(path);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  cookieHeaders(response);
  return (await response.json()).token;
}

(async () => {
  const page = await request('/login');
  cookieHeaders(page);
  const html = await page.text();
  const anonymous = html.match(/name="_csrf" value="([a-f0-9]{64})"/)?.[1];
  assert.ok(anonymous);
  assert.match(html, new RegExp('name="csrf-token" content="' + anonymous + '"'));
  const credentials = { correo: 'admin@audit.example', password: 'Audit-Only-Password-2026' };
  assert.equal((await request('/login', { body: credentials })).status, 403);
  assert.equal((await request('/login', { body: credentials, token: '0'.repeat(64) })).status, 403);
  assert.equal((await request('/login?_csrf=' + anonymous, { body: credentials })).status, 403);
  assert.equal((await request('/login', { body: credentials, token: anonymous, cookie: '' })).status, 403);
  assert.equal((await request('/login', { body: credentials, token: anonymous, headers: { Origin: 'https://outside.example' } })).status, 403);
  assert.equal((await request('/login', { body: credentials, token: anonymous, headers: { Origin: base, Referer: 'https://outside.example/form' } })).status, 403);
  const login = await request('/login', { body: { ...credentials, _csrf: anonymous }, headers: { Origin: base } });
  assert.equal(login.status, 302);
  cookieHeaders(login);
  const pending = await state('/login/csrf-token');
  assert.notEqual(anonymous, pending);
  assert.equal((await request('/login/cancelar', { body: {}, token: anonymous })).status, 403);
  assert.equal((await request('/login/verificar', { body: {}, token: pending, cookie: auth.crm_csrf })).status, 403);
  const mail = JSON.parse(execFileSync('docker', [...args, 'exec', '-T', 'app', 'cat', '/tmp/crm-auth-test-mail.json'], { encoding: 'utf8' }));
  const verified = await request('/login/verificar', { body: { code: mail.code }, token: pending });
  assert.equal(verified.status, 302);
  cookieHeaders(verified);
  const session = await state('/csrf-token');
  assert.notEqual(session, pending);
  assert.equal((await request('/logout', { body: {}, token: pending })).status, 403);
  assert.equal((await request('/logout', { body: {}, token: session, cookie: auth.crm_csrf })).status, 403);
  const loggedOut = await request('/logout', { body: {}, token: session });
  assert.equal(loggedOut.status, 302);
  cookieHeaders(loggedOut);
  assert.notEqual(await state('/login/csrf-token'), anonymous);
  assert.equal((await request('/login', { body: credentials, token: anonymous })).status, 403);
  const current = await state('/login/csrf-token');
  const fictitious = { correo: 'rate-limit@example.com', password: 'bad-password' };
  for (let attempt = 0; attempt < 5; attempt++)
    assert.equal((await request('/login', { body: fictitious, token: current })).status, 401);
  const blocked = await request('/login', { body: fictitious, token: current });
  assert.equal(blocked.status, 429);
  assert.match(blocked.headers.get('retry-after'), /^[1-9][0-9]*$/);
  assert.equal((await request('/login', { body: { ...fictitious, correo: 'other@example.com' }, token: current })).status, 401);

  const recovery = await request('/login/recuperar', { body: { correo: 'other@example.com' }, token: current });
  assert.equal(recovery.status, 302);
  cookieHeaders(recovery);
  const resetBody = { code: '000000', password: 'Audit-password-2026', confirmPassword: 'Audit-password-2026' };
  assert.equal((await request('/login/recuperar/restablecer', { body: resetBody, token: current })).status, 403);
  const recoveryToken = await state('/login/recuperar/csrf-token');
  assert.equal((await request('/login/recuperar/restablecer', { body: resetBody, token: recoveryToken, cookie: auth.crm_csrf })).status, 403);
  assert.equal((await request('/login/recuperar/restablecer', { body: resetBody, token: recoveryToken })).status, 400);
  console.log('PASS CSRF enforcement, EJS token and login, pending, session and logout rotation');
})().catch(error => { console.error(error); process.exitCode = 1; });
