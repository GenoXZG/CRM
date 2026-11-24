const assert = require('node:assert/strict');
const { test } = require('node:test');
const { RateLimit, clientNetwork, accountAtNetwork } = require('../../dist/rate-limit');

test('normalizes equivalent networks and isolates accounts and operations', () => {
  assert.equal(clientNetwork('::ffff:c000:201'), clientNetwork('192.0.2.1'));
  assert.equal(clientNetwork('2001:db8:12::123'), clientNetwork('2001:0DB8:12:0000::ffff'));
  assert.notEqual(clientNetwork('2001:db8:12::123'), clientNetwork('2001:db8:12:1::123'));
  assert.equal(clientNetwork(undefined), 'unknown');
  const login = new RateLimit(1, 15000);
  const recovery = new RateLimit(1, 15000);
  const firstAccount = accountAtNetwork('192.0.2.1', 'first@example.test');
  assert.equal(login.consume(firstAccount), 0);
  assert.equal(login.consume(firstAccount), 15);
  assert.equal(login.consume(accountAtNetwork('192.0.2.1', 'second@example.test')), 0);
  assert.equal(login.consume(accountAtNetwork('192.0.2.2', 'first@example.test')), 0);
  assert.equal(recovery.consume(firstAccount), 0);
});

test('retires expired counters and limits saturation to individual shards', () => {
  let time = 0;
  const limiter = new RateLimit(2, 15000, 1, () => time);
  const accepted = [];
  for (let index = 0; index < 256; index++) {
    const key = 'client:' + index;
    if (!limiter.consume(key)) accepted.push(key);
  }
  assert.ok(accepted.length > 1 && accepted.length <= 32);
  const existing = accepted[0];
  assert.equal(limiter.consume(existing), 0);
  assert.equal(limiter.consume(existing), 15);
  time = 14250;
  assert.equal(limiter.consume(existing), 1);
  time = 15000;
  assert.equal(limiter.consume(existing), 0);
  limiter.reset(existing);
  assert.equal(limiter.consume(existing), 0);
  assert.equal(limiter.consume(existing), 0);
});
