const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const baseEnvironment = {
  NODE_ENV: 'test',
  DB_NAME: 'phase1_test',
  DB_USER: 'phase1_test',
  CRM_DEPLOYMENT: 'local',
  TRUSTED_PROXY_IP: '',
  COOKIE_SECURE: 'false',
  AUTH_2FA_TO: '',
};

function run(code, settings = {}) {
  return spawnSync(process.execPath, ['-e', code], {
    cwd: require('node:path').resolve(__dirname, '../..'),
    env: { ...baseEnvironment, ...settings },
    encoding: 'utf8',
    timeout: 15000,
  });
}

test('deployment settings validate proxy and shared mail independently of NODE_ENV', () => {
  const config = "console.log(JSON.stringify(require('./dist/config').configuration.auth))";
  for (const [settings, message] of [
    [{ CRM_DEPLOYMENT: 'demo' }, /Invalid CRM_DEPLOYMENT/],
    [{ CRM_DEPLOYMENT: 'public' }, /TRUSTED_PROXY_IP is required/],
    [{ TRUSTED_PROXY_IP: '127.0.0.0/8' }, /Invalid TRUSTED_PROXY_IP/],
    [{ TRUSTED_PROXY_IP: 'true' }, /Invalid TRUSTED_PROXY_IP/],
    [{ AUTH_2FA_TO: 'shared@example.test' }, /AUTH_2FA_TO requires CRM_DEPLOYMENT=test/],
    [{ CRM_DEPLOYMENT: 'public', TRUSTED_PROXY_IP: '127.0.0.1', AUTH_2FA_TO: 'shared@example.test' }, /AUTH_2FA_TO requires CRM_DEPLOYMENT=test/],
  ]) {
    const result = run(config, settings);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, message);
    assert.doesNotMatch(result.stderr, /shared@example\.test/);
  }
  const result = run("require('dotenv').config = () => ({}); console.log(require('./dist/config').configuration.auth.testCodeRecipient)", {
    NODE_ENV: 'production', CRM_DEPLOYMENT: 'test', AUTH_2FA_TO: 'shared@example.test',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), 'shared@example.test');
});

async function checkApplication() {
  const assert = require('node:assert/strict');
  const { once } = require('node:events');
  const { createApplication } = require('./dist/app');
  const { setAuthCookie } = require('./dist/auth-cookies');
  const app = createApplication();
  const proxyTrusted = ['127.0.0.1', '::ffff:127.0.0.1'].includes(process.env.TRUSTED_PROXY_IP);
  const publicProfile = process.env.CRM_DEPLOYMENT === 'public';
  const forcedSecure = publicProfile || process.env.COOKIE_SECURE === 'true';

  app.get('/assets/test-request', (request, response) => {
    for (const [name, maxAge] of [['crm_session', 43200], ['crm_pending', 300], ['crm_recovery', 600]]) {
      setAuthCookie(request, response, name, 'test-value', maxAge);
      setAuthCookie(request, response, name, '', 0);
    }
    response.json({ ip: request.ip, secure: request.secure });
  });

  const server = app.listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const base = 'http://127.0.0.1:' + server.address().port;
    const forwarded = { 'X-Forwarded-For': '192.0.2.1, 192.0.2.2', 'X-Forwarded-Proto': 'https' };
    for (const headers of [{}, forwarded]) {
      const trustedHeaders = headers === forwarded && proxyTrusted;
      const result = await fetch(base + '/assets/test-request', { headers, redirect: 'manual' });
      assert.deepEqual(await result.json(), {
        ip: trustedHeaders ? '192.0.2.2' : '127.0.0.1', secure: trustedHeaders,
      });
      const cookies = result.headers.getSetCookie();
      const expected = [
        'crm_session=test-value; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200',
        'crm_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0',
        'crm_pending=test-value; HttpOnly; SameSite=Lax; Path=/login; Max-Age=300',
        'crm_pending=; HttpOnly; SameSite=Lax; Path=/login; Max-Age=0',
        'crm_recovery=test-value; HttpOnly; SameSite=Lax; Path=/login/recuperar; Max-Age=600',
        'crm_recovery=; HttpOnly; SameSite=Lax; Path=/login/recuperar; Max-Age=0',
      ];
      assert.deepEqual(cookies, expected.map(cookie => cookie + (forcedSecure || trustedHeaders ? '; Secure' : '')));
    }
    const state = await fetch(base + '/login/csrf-token', { headers: forwarded });
    const csrfCookie = state.headers.getSetCookie()[0];
    assert.match(csrfCookie, forcedSecure || proxyTrusted
      ? /^__Host-crm_csrf=.*; Secure$/ : /^crm_csrf=/);
    const { token } = await state.json();
    const login = (origin, headers = forwarded) => fetch(base + '/login', {
      method: 'POST', headers: { ...headers, Origin: origin, Cookie: csrfCookie.split(';')[0], 'X-CSRF-Token': token },
    });
    const httpsOrigin = base.replace('http:', 'https:');
    assert.equal((await login(httpsOrigin)).status, proxyTrusted ? 400 : 403);
    assert.equal((await login('https://unrelated.example')).status, 403);
    if (proxyTrusted) {
      for (let attempt = 0; attempt < 9; attempt++) assert.equal((await login(httpsOrigin)).status, 400);
      assert.equal((await login(httpsOrigin)).status, 429);
      assert.equal((await login(httpsOrigin, { ...forwarded, 'X-Forwarded-For': '192.0.2.3' })).status, 400);
    }
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

test('client IP, origin and cookie attributes follow the immediate proxy and deployment profile', () => {
  for (const settings of [
    {},
    { TRUSTED_PROXY_IP: '192.0.2.10' },
    { CRM_DEPLOYMENT: 'public', TRUSTED_PROXY_IP: '127.0.0.1' },
    { CRM_DEPLOYMENT: 'test', TRUSTED_PROXY_IP: '::ffff:127.0.0.1' },
    { COOKIE_SECURE: 'true' },
  ]) {
    const result = run(`(${checkApplication})().catch(error => { console.error(error); process.exitCode = 1; })`, settings);
    assert.equal(result.status, 0, result.stderr || String(result.error));
  }
});
