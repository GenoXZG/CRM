// Isolated integration audit. All emails use the mock provider; no real accounts.
const { execFileSync } = require('node:child_process');
const { csrfFetch } = require('./csrf-client.cjs');
const source = csrfFetch.toString() + String.raw`
const assert = require('node:assert/strict'), fs = require('node:fs');
const { randomBytes } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const m = require('./dist/infrastructure/database/models');
let deliveryGate;
let deliveryStarts = 0;
require('./dist/services/email-service').sendEmail = async (to, subject, text) => {
  if (deliveryGate) { deliveryStarts++; await deliveryGate; }
  if (fs.existsSync('/tmp/crm-auth-mail-fail')) throw new Error('Simulated provider failure');
  fs.writeFileSync('/tmp/crm-auth-test-mail.json', JSON.stringify({ to, subject, text, code: text.match(/Tu código es: (\d{6})/)?.[1], account: text.match(/con la cuenta ([^\s]+)\./)?.[1] }), { mode: 0o600 });
  return 'mock-id';
};
const { passwordHash } = require('./dist/auth');
const { tokenHash, credentialHash, createChallenge } = require('./dist/auth-challenge');
const { requestPasswordRecovery, resetPassword } = require('./dist/services/password-recovery-service');
const marker = 'recovery_' + Date.now(), email = marker + '@example.com';
const oldPassword = 'Original-pass-2026', newPassword = 'Replacement-pass-2026';
let id, checks = 0;
const eq = (a, b, label) => { assert.equal(a, b, label); checks++; };
const sql = (query, replacements = []) => m.database.query(query, { replacements });
const mail = () => JSON.parse(fs.readFileSync('/tmp/crm-auth-test-mail.json', 'utf8'));
async function request(path, body, cookie, origin) {
  return csrfFetch('http://127.0.0.1:3030' + path, { method: body ? 'POST' : 'GET', redirect: 'manual', headers: { ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(origin ? { Origin: origin } : {}) }, body: body ? new URLSearchParams(body) : undefined });
}
async function fresh() {
  await sql('UPDATE recuperaciones_password SET creado_en=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 61 SECOND) WHERE id_usuario=?', [id]);
  const token = await requestPasswordRecovery(email);
  await waitFor(async () => (await state())?.enviado === 1);
  return { token, code: mail().code };
}
const state = async () => (await sql('SELECT * FROM recuperaciones_password WHERE id_usuario=?', [id]))[0][0];
async function waitFor(predicate) {
  const deadline = Date.now() + 3000;
  while (!await predicate()) {
    if (Date.now() >= deadline) throw new Error('Recovery delivery did not settle');
    await delay(20);
  }
}
const user = async () => (await sql('SELECT * FROM usuarios WHERE id=?', [id]))[0][0];
(async () => {
  try {
    const [created] = await sql('INSERT INTO usuarios(correo,password_hash,rol) VALUES(?,?,?)', [email, await passwordHash(oldPassword), 'coordinador']); id = created;
    eq((await request('/login/recuperar')).status, 200, 'public recovery form');
    eq((await request('/login/recuperar/restablecer')).status, 302, 'requires browser token');
    eq((await request('/login/recuperar', { correo: email }, null, 'https://evil.example')).status, 403, 'cross-origin rejected');
    const unknown = await request('/login/recuperar', { correo: marker + 'missing@example.com' });
    eq(unknown.status, 302, 'unknown generic redirect');
    const unknownCookie = unknown.headers.getSetCookie()[0].split(';')[0];
    const known = await request('/login/recuperar', { correo: email });
    eq(known.status, 302, 'known same redirect');
    eq(known.headers.get('location'), unknown.headers.get('location'), 'same destination');
    const cookieHeader = known.headers.getSetCookie()[0], cookie = cookieHeader.split(';')[0];
    eq(cookieHeader.includes('HttpOnly; SameSite=Lax; Path=/login/recuperar; Max-Age=600'), true, 'scoped httpOnly cookie');
    await waitFor(async () => (await state())?.enviado === 1);
    const code = mail().code;
    eq(/^\d{6}$/.test(code), true, 'six-digit code');
    eq(mail().to, 'shared@audit.example', 'temporary configured recipient');
    eq(mail().account, email, 'account identified in recovery mail');
    let row = await state();
    assert.match(row.token_hash, /^[a-f0-9]{64}$/);
    assert.match(cookie.split('=')[1], /^[a-f0-9]{120}$/);
    eq(row.code_hash !== code && !row.code_hash.includes(code), true, 'code stored as keyed hash');
    const hashBefore = (await user()).password_hash;
    const repeated = await request('/login/recuperar', { correo: email }, cookie);
    const repeatedCookie = repeated.headers.getSetCookie()[0].split(';')[0];
    eq(repeated.status, 302, 'cooldown response remains generic');
    eq(repeatedCookie === cookie, false, 'cooldown reissues different ciphertext');
    await requestPasswordRecovery(email);
    eq((await state()).token_hash, row.token_hash, 'one-minute cooldown preserves original code');
    eq((await user()).password_hash, hashBefore, 'request alone does not change password');
    const wrong = code === '000000' ? '000001' : '000000';
    eq((await request('/login/recuperar/restablecer', { code, password: 'short', confirmPassword: 'short' }, cookie)).status, 400, 'password policy');
    eq((await request('/login/recuperar/restablecer', { code, password: newPassword, confirmPassword: 'mismatch' }, cookie)).status, 400, 'confirmation required');
    eq((await state()).intentos, 0, 'form validation does not consume code');
    const wrongReset = await request('/login/recuperar/restablecer', { code: wrong, password: newPassword, confirmPassword: newPassword }, cookie);
    eq(wrongReset.status, 400, 'wrong code');
    eq(wrongReset.headers.getSetCookie().length, 0, 'wrong code keeps the form state');
    assert.match(await wrongReset.text(), /No se pudo verificar el código/);
    eq((await state()).intentos, 1, 'wrong code counted');
    const oldSession = randomBytes(32).toString('hex');
    await sql('INSERT INTO sesiones_usuario(token_hash,id_usuario,expira_en,segundo_factor) VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 HOUR),1)', [tokenHash(oldSession), id]);
    const loginPending = await createChallenge(id, credentialHash(await user()), null);
    const loginCode = mail().code;
    eq(await resetPassword(loginPending, loginCode, newPassword), 'expired', 'login challenge cannot reset password');
    const success = await request('/login/recuperar/restablecer', { code, password: newPassword, confirmPassword: newPassword }, repeatedCookie);
    eq(success.status, 200, 'reset succeeds');
    eq((await success.text()).includes('Contraseña actualizada'), true, 'success screen');
    eq((await user()).password_hash.startsWith('scrypt:'), true, 'password hashed');
    eq((await user()).password_hash !== hashBefore, true, 'new password saved');
    eq((await user()).rol, 'coordinador', 'role unchanged');
    for (const table of ['sesiones_usuario', 'desafios_login', 'recuperaciones_password']) eq((await sql('SELECT COUNT(*) AS n FROM ' + table + ' WHERE id_usuario=?', [id]))[0][0].n, 0, table + ' revoked');
    eq((await request('/tickets', null, 'crm_session=' + oldSession)).status, 302, 'old session unusable');
    eq((await request('/login', { correo: email, password: oldPassword })).status, 401, 'old password rejected');
    const login = await request('/login', { correo: email, password: newPassword });
    eq(login.status, 302, 'new password accepted');
    eq(login.headers.get('location'), '/login/verificar', '2FA still required');
    const loginCookie = login.headers.getSetCookie().find(c => c.startsWith('crm_pending=')).split(';')[0];
    eq((await request('/login/verificar', { code: mail().code }, loginCookie)).status, 302, 'normal 2FA still works');
    let releaseDelivery;
    deliveryGate = new Promise(resolve => { releaseDelivery = resolve; });
    try {
      const simultaneous = await Promise.all([requestPasswordRecovery(email), requestPasswordRecovery(email)]);
      await waitFor(() => deliveryStarts === 1);
      const queued = await state();
      const queuedToken = simultaneous.find(value => tokenHash(value) === queued.token_hash);
      assert.ok(queuedToken);
      eq(queued.enviado, 0, 'recover request returns while mail is pending');
      eq(await resetPassword(queuedToken, '000000', oldPassword), 'expired', 'pending mail cannot redeem');
      eq((await state()).token_hash, queued.token_hash, 'early reset does not cancel delivery');
    } finally {
      releaseDelivery();
      deliveryGate = undefined;
    }
    await waitFor(async () => (await state())?.enviado === 1);
    eq(deliveryStarts, 1, 'concurrent recovery requests send one email');
    let pending = await fresh();
    for (let i = 0; i < 5; i++) eq(await resetPassword(pending.token, 'invalid', newPassword), i === 4 ? 'expired' : 'invalid', 'five-attempt cap');
    eq(await resetPassword(pending.token, pending.code, newPassword), 'expired', 'correct code denied after exhaustion');
    pending = await fresh();
    await sql('UPDATE recuperaciones_password SET expira_en=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 SECOND) WHERE id_usuario=?', [id]);
    eq(await resetPassword(pending.token, pending.code, newPassword), 'expired', 'expiry enforced');
    pending = await fresh(); const replacement = await fresh();
    eq(await resetPassword(pending.token, pending.code, newPassword), 'expired', 'replacement invalidates old token');
    // Force a transactional failure after the password UPDATE, then verify rollback.
    const query = m.database.query;
    m.database.query = function(statement, options) {
      if (statement === 'DELETE FROM sesiones_usuario WHERE id_usuario=?') throw new Error('audit rollback');
      return query.call(this, statement, options);
    };
    const beforeRollback = (await user()).password_hash;
    try { await assert.rejects(resetPassword(replacement.token, replacement.code, oldPassword)); checks++; }
    finally { m.database.query = query; }
    eq((await user()).password_hash, beforeRollback, 'failed transaction preserves password');
    eq(Boolean(await state()), true, 'failed transaction preserves challenge');
    const auth = require('./dist/auth');
    const originalHash = auth.passwordHash;
    let hashCalls = 0;
    auth.passwordHash = async (...args) => { hashCalls++; return originalHash(...args); };
    let results;
    try {
      const wrongCode = replacement.code === '000000' ? '000001' : '000000';
      eq(await resetPassword(replacement.token, wrongCode, newPassword), 'invalid', 'wrong code rejected before scrypt');
      eq(hashCalls, 0, 'wrong code does not run scrypt');
      results = await Promise.all([resetPassword(replacement.token, replacement.code, newPassword), resetPassword(replacement.token, replacement.code, newPassword)]);
      eq(hashCalls, 1, 'concurrent correct requests run scrypt once');
    } finally { auth.passwordHash = originalHash; }
    eq(results.filter(r => r === 'ok').length, 1, 'concurrent redemption single use');
    pending = await fresh();
    await sql('UPDATE usuarios SET correo=? WHERE id=?', [marker + 'changed@example.com', id]);
    eq(await resetPassword(pending.token, pending.code, oldPassword), 'expired', 'credential edits invalidate code');
    await sql('UPDATE usuarios SET correo=? WHERE id=?', [email, id]);
    fs.writeFileSync('/tmp/crm-auth-mail-fail', '1');
    const failure = await request('/login/recuperar', { correo: email });
    eq(failure.status, unknown.status, 'provider failure generic response');
    const failedRow = await state();
    eq(failedRow.enviado, 0, 'failed email cannot be redeemed');
    await requestPasswordRecovery(email);
    eq((await state()).token_hash, failedRow.token_hash, 'failed delivery still applies account cooldown');
    fs.unlinkSync('/tmp/crm-auth-mail-fail');
    const accountLimit = await request('/login/recuperar', { correo: email });
    eq(accountLimit.status, 429, 'account at IP rate limit');
    assert.match(accountLimit.headers.get('retry-after'), /^[1-9][0-9]*$/);
    eq((await request('/login/recuperar', { correo: email })).status, 429, 'IP request rate limit');
    const unknownReset = await request('/login/recuperar/restablecer', { code, password: newPassword, confirmPassword: newPassword }, unknownCookie);
    eq(unknownReset.status, 400, 'unknown token cannot reset');
    eq(unknownReset.headers.getSetCookie().length, 0, 'unknown token keeps the form state');
    assert.match(await unknownReset.text(), /No se pudo verificar el código/);
    const saved = (await user()).password_hash;
    for (let i = 0; i < 20; i++) await request('/login/recuperar/restablecer', { code, password: newPassword, confirmPassword: newPassword }, unknownCookie);
    eq((await request('/login/recuperar/restablecer', { code, password: newPassword, confirmPassword: newPassword }, unknownCookie)).status, 429, 'IP reset rate limit');
    eq((await user()).password_hash, saved, 'invalid requests never change password');
    console.log('PASS ' + checks + ' checks: recovery, expiry, single use, concurrency, rollback, rate limits, session revocation and normal 2FA');
  } finally {
    if (fs.existsSync('/tmp/crm-auth-mail-fail')) fs.unlinkSync('/tmp/crm-auth-mail-fail');
    if (id) await sql('DELETE FROM usuarios WHERE id=?', [id]);
    await m.database.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
`;
execFileSync('docker', ['compose', '-p', 'crm-auth-audit', '-f', 'compose.yaml', '-f', 'docker/compose.auth-audit.yaml', 'exec', '-T', 'app', 'node'], { encoding: 'utf8', input: source, stdio: ['pipe', 'inherit', 'inherit'] });
