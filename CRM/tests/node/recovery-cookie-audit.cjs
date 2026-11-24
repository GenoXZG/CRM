const assert = require('node:assert/strict');
const { test } = require('node:test');
Object.assign(process.env, { NODE_ENV: 'test', DB_NAME: 'cookie_test', DB_USER: 'cookie_test' });
const { openRecoveryToken, sealRecoveryToken } = require('../../dist/recovery-cookie');

test('recovery cookies conceal token reuse and reject altered ciphertext', () => {
  const token = 'a'.repeat(64);
  const sealed = sealRecoveryToken(token);
  assert.notEqual(sealRecoveryToken(token), sealed);
  assert.equal(sealed.length, 120);
  const request = value => ({ headers: { cookie: 'crm_recovery=' + value } });
  assert.equal(openRecoveryToken(request(sealed)), token);
  assert.equal(openRecoveryToken(request(token)), token, 'in-flight legacy cookie');
  const altered = (sealed[0] === '0' ? '1' : '0') + sealed.slice(1);
  assert.equal(openRecoveryToken(request(altered)), null);
});
