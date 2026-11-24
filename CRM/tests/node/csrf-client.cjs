// Keeps the audit clients independent of a particular HTTP cookie jar.
async function csrfFetch(url, options = {}) {
  if (!options.method || ['GET', 'HEAD', 'OPTIONS'].includes(options.method)) return fetch(url, options);
  const target = new URL(url);
  const scope = target.pathname.startsWith('/login/recuperar') ? '/login/recuperar'
    : target.pathname.startsWith('/login') ? '/login' : '';
  const headers = new Headers(options.headers);
  const state = await fetch(target.origin + scope + '/csrf-token', { headers });
  if (!state.ok) throw new Error('CSRF bootstrap failed: ' + state.status);
  const { token } = await state.json();
  const nonce = state.headers.getSetCookie().find(cookie => /^(?:__Host-)?crm_csrf=/.test(cookie));
  if (nonce) headers.set('Cookie', [headers.get('Cookie'), nonce.split(';')[0]].filter(Boolean).join('; '));
  headers.set('X-CSRF-Token', token);
  return fetch(url, { ...options, headers });
}

module.exports = { csrfFetch };
