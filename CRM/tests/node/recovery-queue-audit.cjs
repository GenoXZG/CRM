const assert = require('node:assert/strict');
const { setImmediate } = require('node:timers/promises');
const { test } = require('node:test');

Object.assign(process.env, { NODE_ENV: 'test', DB_NAME: 'queue_test', DB_USER: 'queue_test' });
const { database } = require('../../dist/infrastructure/database/connection');
const mail = require('../../dist/services/email-service');
const { requestPasswordRecovery } = require('../../dist/services/password-recovery-service');

test('recovery queue emits bounded telemetry with no target or provider details', async () => {
  const originals = { transaction: database.transaction, query: database.query, send: mail.sendEmail, warn: console.warn };
  const records = [];
  console.warn = (...message) => records.push(message);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const pending = [];
  try {
    database.transaction = async () => { await gate; return { token: 'f'.repeat(64) }; };
    for (let index = 0; index < 32; index++) pending.push(requestPasswordRecovery('queue-fixture@example.test'));
    assert.match(await requestPasswordRecovery('queue-fixture@example.test'), /^[a-f0-9]{64}$/);
    assert.match(await requestPasswordRecovery('queue-fixture@example.test'), /^[a-f0-9]{64}$/);
    release();
    await Promise.all(pending);
    database.transaction = async () => ({ token: 'f'.repeat(64), email: 'queue-fixture@example.test' });
    database.query = async () => [{ found: 1 }];
    mail.sendEmail = async () => { throw new Error('private provider details'); };
    await requestPasswordRecovery('queue-fixture@example.test');
    await setImmediate();
    assert.deepEqual(records, [
      ['password_recovery_delivery', { event: 'saturated', total: 1, outstanding: 32 }],
      ['password_recovery_delivery', { event: 'failed', total: 1, outstanding: 1 }],
    ]);
  } finally {
    release();
    console.warn = originals.warn;
    database.transaction = originals.transaction;
    database.query = originals.query;
    mail.sendEmail = originals.send;
  }
});
