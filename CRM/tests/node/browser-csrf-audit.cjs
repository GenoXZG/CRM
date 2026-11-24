const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { test } = require('node:test');

test('the compiled browser client sends the CSRF header only to its own origin', async () => {
  const source = await readFile(require.resolve('../../public/assets/shared/http.js'));
  const { requestJson, postJson } = await import('data:text/javascript;base64,' + source.toString('base64'));
  global.location = new URL('https://crm.example.test/tickets');
  global.document = {
    querySelector(selector) {
      assert.equal(selector, 'meta[name="csrf-token"]');
      return { content: 'test-token' };
    },
  };
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return Response.json({ success: true });
  };
  try {
    await requestJson('/tickets');
    assert.equal(calls[0].options.headers, undefined);
    await postJson('/add_ticket', { ticket: 'test' });
    assert.equal(calls[1].options.headers.get('Content-Type'), 'application/json');
    assert.equal(calls[1].options.headers.get('X-CSRF-Token'), 'test-token');
    assert.equal(calls[1].options.mode, 'same-origin');
    await requestJson('/equipos/2', { method: 'DELETE' });
    assert.equal(calls[2].options.headers.get('X-CSRF-Token'), 'test-token');
    await assert.rejects(postJson('https://outside.example/api', {}));
    assert.equal(calls.length, 3);
  } finally {
    global.fetch = originalFetch;
    delete global.location;
    delete global.document;
  }
});
