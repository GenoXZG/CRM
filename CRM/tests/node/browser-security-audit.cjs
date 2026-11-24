// Requires an isolated audit Compose project in public/enforce mode and a local TLS fixture.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const { once } = require('node:events');
const { chromium } = require(process.env.CRM_BROWSER_DRIVER || 'playwright-core');

const auditProject = process.env.CRM_AUDIT_PROJECT || 'crm-auth-audit';
const args = ['compose', '-p', auditProject, '-f', 'compose.yaml', '-f', 'docker/compose.auth-audit.yaml'];
const fixturePng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAMAAAADCAIAAADZSiLoAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEElEQVQImWMQMgmDIAYsLABP/gV93GAXdgAAAABJRU5ErkJggg==', 'base64');

function mail(expectedSubject) {
  for (let tries = 0; tries < 15; tries++) {
    const message = JSON.parse(execFileSync('docker', [...args, 'exec', '-T', 'app', 'cat', '/tmp/crm-auth-test-mail.json'], { encoding: 'utf8' }));
    if (message.subject?.startsWith(expectedSubject)) return message.code;
  }
  throw new Error('Mock mail did not arrive');
}

(async () => {
  const observations = [];
  let base;
  const insecure = http.createServer((request, response) => {
    observations.push({ url: request.url, method: request.method, cookie: request.headers.cookie || '' });
    response.end('HTTP probe');
  }).listen(0, '127.0.0.1');
  const proxy = https.createServer({
    cert: fs.readFileSync(process.env.CRM_BROWSER_TLS_CERT),
    key: fs.readFileSync(process.env.CRM_BROWSER_TLS_KEY),
  }, (request, response) => {
    if (request.headers.host?.startsWith('cross.test:')) {
      response.setHeader('Content-Type', 'text/html');
      return response.end('<form method="post" action="' + base + '/logout"><button>Cross-site POST</button></form>');
    }
    observations.push({ url: request.url, method: request.method, cookie: request.headers.cookie || '' });
    const upstream = http.request({
      hostname: '127.0.0.1', port: 3031, method: request.method, path: request.url,
      headers: { ...request.headers, 'x-forwarded-proto': 'https', 'x-forwarded-for': request.socket.remoteAddress },
    }, upstreamResponse => {
      response.writeHead(upstreamResponse.statusCode, upstreamResponse.headers);
      upstreamResponse.pipe(response);
    });
    upstream.on('error', () => { if (!response.headersSent) response.writeHead(502); response.end(); });
    request.pipe(upstream);
  }).listen(0, '127.0.0.1');

  let browser;
  try {
    await Promise.all([once(insecure, 'listening'), once(proxy, 'listening')]);
    const port = proxy.address().port;
    base = 'https://crm.test:' + port;
    browser = await chromium.launch({
      executablePath: process.env.CRM_BROWSER_EXECUTABLE,
      args: ['--no-sandbox', '--no-proxy-server', '--host-resolver-rules=MAP crm.test 127.0.0.1, MAP cross.test 127.0.0.1'],
    });
    const context = await browser.newContext({
      ignoreHTTPSErrors: true, permissions: ['geolocation'], geolocation: { latitude: 19.4, longitude: -99.1 },
    });
    // The fixture substitutes only map tiles. It still exercises the CSP host rule.
    await context.route('https://tile.openstreetmap.org/**', route => route.fulfill({ body: fixturePng, contentType: 'image/png' }));
    const violations = [];
    await context.exposeBinding('recordCspViolation', (_source, event) => violations.push(event));
    await context.addInitScript(() => {
      window.addEventListener('securitypolicyviolation', event => window.recordCspViolation({
        directive: event.effectiveDirective, source: event.blockedURI,
      }));
    });
    const page = await context.newPage();
    const login = await page.goto(base + '/login');
    assert.match(login.headers()['strict-transport-security'], /^max-age=31536000$/);
    assert.match(login.headers()['content-security-policy'], /script-src-attr 'none'/);
    assert.equal(await page.locator('.login-card').evaluate(card => getComputedStyle(card).borderRadius), '18px');

    await page.locator('#correo').fill('admin@audit.example');
    await page.locator('#password').fill('Audit-Only-Password-2026');
    await page.getByRole('button', { name: 'Enviar código de acceso' }).click();
    await page.waitForURL('**/login/verificar');
    const pending = (await context.cookies()).find(cookie => cookie.name === 'crm_pending');
    assert.equal(pending.path, '/login');
    assert.equal(pending.secure, true);
    assert.equal(pending.httpOnly, true);
    assert.equal(pending.sameSite, 'Lax');
    await page.goto(base + '/csrf-token');
    assert.doesNotMatch(observations.at(-1).cookie, /crm_pending=/);
    await page.goto(base + '/login/verificar');
    assert.ok(observations.some(entry => entry.url === '/login/verificar' && entry.cookie.includes('crm_pending=')));
    await page.locator('#code').fill(mail('Código de acceso'));
    await page.getByRole('button', { name: 'Verificar e ingresar' }).click();
    await page.waitForURL(base + '/');
    const cookies = await context.cookies();
    const session = cookies.find(cookie => cookie.name === 'crm_session');
    const csrf = cookies.find(cookie => cookie.name === '__Host-crm_csrf');
    for (const cookie of [session, csrf]) {
      assert.equal(cookie.path, '/');
      assert.equal(cookie.secure, true);
      assert.equal(cookie.httpOnly, true);
      assert.equal(cookie.sameSite, 'Lax');
    }

    await page.goto('http://crm.test:' + insecure.address().port + '/insecure-probe');
    assert.equal(observations.at(-1).url, '/insecure-probe');
    assert.doesNotMatch(observations.at(-1).cookie, /crm_session=|crm_csrf=/);
    await page.goto('https://cross.test:' + port);
    const cross = page.waitForResponse(response => response.url() === base + '/logout');
    await page.getByRole('button', { name: 'Cross-site POST' }).click();
    assert.equal((await cross).status(), 403);
    const crossPost = observations.findLast(entry => entry.url === '/logout' && entry.method === 'POST');
    assert.doesNotMatch(crossPost.cookie, /crm_session=|crm_csrf=/);

    await page.goto(base + '/detalle_ticket/2', { waitUntil: 'domcontentloaded' });
    assert.equal(await page.evaluate(() => typeof window.bootstrap), 'object');
    await page.waitForFunction(() => typeof window.Swal === 'function');
    await page.locator('[data-bs-target="#modalEditarMaps"]').click();
    const modal = page.locator('#modalEditarMaps');
    await modal.waitFor({ state: 'visible' });
    await modal.locator('.leaflet-tile-loaded').first().waitFor({ state: 'attached' });
    await modal.locator('[data-location-current]').click();
    await modal.locator('.leaflet-marker-icon').first().waitFor({ state: 'attached' });
    page.once('dialog', dialog => dialog.accept());
    await modal.locator('[data-bs-dismiss="modal"]').first().click();
    await modal.waitFor({ state: 'hidden' });

    await page.evaluate(() => { void window.Swal.fire({ title: 'CSP fixture' }); });
    await page.locator('.swal2-popup').waitFor({ state: 'visible' });
    await page.locator('.swal2-confirm').click();
    await page.locator('.swal2-popup').waitFor({ state: 'hidden' });

    const attribution = await page.evaluate(async () => {
      const { safeMapAttribution } = await import('/assets/shared/map-attribution.js');
      const template = document.createElement('template');
      template.innerHTML = safeMapAttribution('&copy; <a href="https://tiles.example.test/">Proveedor</a> <a href="https://tiles.example.test/" onclick="alert(1)">Texto</a> <img src="invalid" onerror="alert(1)"><a href="javascript:void(0)">Etiqueta</a>');
      return {
        links: Array.from(template.content.querySelectorAll('a'), link => ({ href: link.href, label: link.textContent })),
        active: template.content.querySelectorAll('[onclick], [onerror], img').length,
        text: template.content.textContent,
      };
    });
    assert.deepEqual(attribution.links, [{ href: 'https://tiles.example.test/', label: 'Proveedor' }]);
    assert.equal(attribution.active, 0);
    assert.match(attribution.text, /©.*Etiqueta/);

    const fetchStatus = await page.evaluate(async () => {
      const { postJson } = await import('/assets/shared/http.js');
      return (await postJson('/tickets/resolver_ubicacion', { url: 'https://www.google.com/maps?q=19.4,-99.1' })).success;
    });
    assert.equal(fetchStatus, true);

    await page.locator('#inputFotosReal').setInputFiles({ name: 'browser-fixture.png', mimeType: 'image/png', buffer: fixturePng });
    await page.locator('#previewContainer img').first().waitFor({ state: 'visible' });
    assert.equal(await page.locator('#previewContainer img').first().evaluate(img => img.complete && img.naturalWidth > 0), true);
    const interruptions = [];
    page.on('requestfailed', request => {
      if (request.isNavigationRequest()) interruptions.push(request.failure()?.errorText);
    });
    page.on('dialog', dialog => {
      interruptions.push(dialog.type());
      void dialog.accept();
    });
    const upload = page.waitForResponse(response => response.url() === base + '/tickets/2/subir-fotos', { timeout: 10000 });
    await page.locator('#btnSubirReal').click();
    const discard = page.getByRole('button', { name: 'Descartar asignaciones y continuar' });
    const confirmation = await Promise.race([
      upload.then(() => false),
      discard.waitFor({ state: 'visible', timeout: 3000 }).then(() => true, () => false),
    ]);
    if (confirmation) await discard.click();
    const uploaded = await upload.catch(error => {
      throw new Error('Upload navigation did not complete: ' + JSON.stringify({ interruptions, violations }), { cause: error });
    });
    assert.equal(uploaded.status(), 302);
    await page.waitForLoadState('domcontentloaded');
    await page.locator('img[src^="/uploads/tickets/"]').first().waitFor({ state: 'visible' });
    await page.waitForFunction(() => Array.from(document.querySelectorAll('img[src^="/uploads/tickets/"]')).some(image => image.complete && image.naturalWidth > 0));
    assert.deepEqual(violations, []);

    await context.clearCookies();
    await page.goto(base + '/login/recuperar');
    await page.locator('#correo').fill('browser-recovery@audit.example');
    await page.getByRole('button', { name: 'Solicitar código' }).click();
    await page.waitForURL('**/login/recuperar/restablecer');
    const recovery = (await context.cookies()).find(cookie => cookie.name === 'crm_recovery');
    assert.equal(recovery.path, '/login/recuperar');
    assert.equal(recovery.secure, true);
    assert.equal(recovery.httpOnly, true);
    assert.equal(recovery.sameSite, 'Lax');
    await page.goto(base + '/login/csrf-token');
    assert.doesNotMatch(observations.at(-1).cookie, /crm_recovery=/);
    await page.goto(base + '/login/recuperar/restablecer');
    assert.ok(observations.some(entry => entry.url === '/login/recuperar/restablecer' && entry.cookie.includes('crm_recovery=')));
    await page.locator('#code').fill(mail('Recuperar contraseña'));
    await page.locator('#password').fill('Browser-replacement-2026');
    await page.locator('#confirmPassword').fill('Browser-replacement-2026');
    await page.getByRole('button', { name: 'Guardar nueva contraseña' }).click();
    await page.getByRole('heading', { name: 'Contraseña actualizada' }).waitFor();
    assert.equal((await context.cookies()).some(cookie => cookie.name === 'crm_recovery'), false);
    assert.deepEqual(violations, []);
    console.log('PASS Chromium: real cookie scope and cross-site behavior, CSP, login/2FA/recovery, Bootstrap, maps, fetch and private evidence');
  } finally {
    if (browser) await browser.close();
    insecure.close();
    proxy.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
