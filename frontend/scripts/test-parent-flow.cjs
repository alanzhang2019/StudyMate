// End-to-end smoke test for the parent invite flow.
// Drives the API via fetch so we sidestep PowerShell quoting issues.

const BASE = 'http://localhost:3001';

function mergeSetCookie(jar, setCookieHeaders) {
  for (const h of setCookieHeaders) {
    const [pair] = h.split(';');
    const [name, ...rest] = pair.split('=');
    const value = rest.join('=');
    jar[name.trim()] = value;
  }
}

function cookieHeader(jar) {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

async function api(path, init = {}, jar) {
  const headers = new Headers(init.headers || {});
  if (jar && Object.keys(jar).length) {
    headers.set('Cookie', cookieHeader(jar));
  }
  const res = await fetch(BASE + path, { ...init, headers, redirect: 'manual' });
  const target = jar ?? {};
  if (res.headers.get('set-cookie')) {
    mergeSetCookie(target, res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')]);
  }
  const text = await res.text();
  let body = text;
  try { body = JSON.parse(text); } catch {}
  return { status: res.status, body, jar: target };
}

(async () => {
  const student = {};
  const create = await api('/api/parent/invite/create', { method: 'POST' }, student);
  console.log('CREATE:', create.status, create.body);
  if (create.status !== 200) process.exit(1);

  const parent = {};
  const redeem = await api(
    '/api/parent/invite/redeem',
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: create.body.code }) },
    parent,
  );
  console.log('REDEEM:', redeem.status, redeem.body);
  console.log('PARENT COOKIE NAMES:', Object.keys(parent));
  if (redeem.status !== 200) process.exit(1);

  const dash = await api('/api/parent/dashboard', {}, parent);
  console.log('DASHBOARD:', dash.status, JSON.stringify(dash.body, null, 2).slice(0, 800));

  const bad = await api(
    '/api/parent/invite/redeem',
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: '000000' }) },
    {},
  );
  console.log('BAD CODE:', bad.status, bad.body);

  const bindings = await api('/api/parent/bindings?role=student', {}, student);
  console.log('STUDENT BINDINGS:', bindings.status, JSON.stringify(bindings.body, null, 2).slice(0, 400));

  const pbindings = await api('/api/parent/bindings?role=parent', {}, parent);
  console.log('PARENT BINDINGS:', pbindings.status, JSON.stringify(pbindings.body, null, 2).slice(0, 400));

  const refresh = await api('/api/parent/insight/refresh', { method: 'POST' }, parent);
  console.log('INSIGHT REFRESH:', refresh.status, refresh.body);

  const badRevoke = await api(
    `/api/parent/bindings/${redeem.body.parentBindingId}/revoke`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ role: 'parent' }) },
    {},
  );
  console.log('REVOKE WITHOUT COOKIE:', badRevoke.status, badRevoke.body);

  const revoke = await api(
    `/api/parent/bindings/${redeem.body.parentBindingId}/revoke`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ role: 'parent' }) },
    parent,
  );
  console.log('REVOKE OK:', revoke.status, revoke.body);

  const dashAfter = await api('/api/parent/dashboard', {}, parent);
  console.log('DASHBOARD AFTER REVOKE:', dashAfter.status, dashAfter.body?.error || JSON.stringify(dashAfter.body, null, 2).slice(0, 200));
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
