const assert = require('node:assert/strict');
const { test } = require('node:test');
const { csvCell } = require('../../dist/adapters/ticket-csv');
const { locationUrl, safeLocationLink } = require('../../dist/domain/location');

test('CSV quotes untrusted text, including formula prefixes normalized by readers', () => {
  for (const text of ['＝SUM(1)', '\u200b +1', ' @identifier', '\tcell', '-3'])
    assert.equal(csvCell(text), '"\'' + text + '"');
  assert.equal(csvCell('O"Brian, Inc.'), '"O""Brian, Inc."');
  assert.equal(csvCell('plain'), '"plain"');
});

test('location links reject non-web schemes and deceptive userinfo', () => {
  for (const value of ['javascript:void(0)', 'data:text/plain,test', 'https://example.test@different.test/']) {
    assert.equal(safeLocationLink(value), null);
    assert.throws(() => locationUrl(value), error => error.status === 400);
  }
  assert.equal(locationUrl('https://www.google.com/maps?q=19.4,-99.1'), 'https://www.google.com/maps?q=19.4,-99.1');
});
