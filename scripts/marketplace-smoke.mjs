// Local opt-in smoke test. Uses an isolated Chrome profile and creates one demo sale.
// No npm dependency; Node 22+ provides fetch and WebSocket.
import { spawn } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const base = process.env.MARKETPLACE_URL || 'http://127.0.0.1:4200';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Smoke test is restricted to localhost.');
const output = path.resolve('backend/storage/app/private/local-setup/smoke-' + Date.now());
await mkdir(output, { recursive: true });
let password = process.env.ARTSPACE_DEMO_PASSWORD;
if (!password) password = JSON.parse(await readFile('backend/storage/app/private/local-setup/credentials.json', 'utf8')).demoPassword;
const chrome = process.env.CHROME_BIN || path.join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe');
const browser = spawn(chrome, ['--headless=new', '--remote-debugging-port=0', '--no-first-run',
  '--no-default-browser-check', '--user-data-dir=' + output, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
try {
  let port;
  for (let i = 0; i < 100; i++) {
    try { port = Number((await readFile(path.join(output, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break; }
    catch { await sleep(100); }
  }
  assert(port, 'Chrome did not initialize.');
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let nextId = 0;
  const pending = new Map();
  const exceptions = [];
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.text);
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  };
  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error('Browser script failed: ' + result.exceptionDetails.text);
    return result.result.value;
  };
  const wait = async expression => {
    for (let i = 0; i < 100; i++) {
      if (await evaluate(expression).catch(() => false)) return;
      await sleep(100);
    }
    throw new Error('Browser state did not become ready: ' + expression);
  };
  const navigate = async route => {
    await command('Page.navigate', { url: base + route });
    await wait('!!document.querySelector("app-navbar") && !document.querySelector("app-root")?.textContent.includes("Loading your server cart...")');
  };
  const api = async (route, method = 'GET', body) => evaluate(`(async () => {
    const token = document.cookie.split('; ').find(c => c.startsWith('XSRF-TOKEN='))?.slice(11);
    const response = await fetch(${JSON.stringify(route)}, {method:${JSON.stringify(method)},
      headers:{Accept:'application/json','Content-Type':'application/json','X-XSRF-TOKEN':decodeURIComponent(token || '')},
      ${body === undefined ? '' : 'body:' + JSON.stringify(JSON.stringify(body)) + ','}
    });
    return {status:response.status, data:await response.json().catch(() => null)};
  })()`);
  const signIn = async username => {
    await api('/api/auth/session');
    const result = await api('/api/auth/session', 'POST', { identifier: username, password });
    assert.equal(result.status, 200, 'Demo login failed.');
  };
  const screenshot = async name => {
    await mkdir('__screenshots__/marketplace', { recursive: true });
    const image = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await writeFile('__screenshots__/marketplace/' + name + '.png', Buffer.from(image.data, 'base64'));
  };
  await command('Runtime.enable');
  await command('Page.enable');
  await navigate('/gallery');
  await wait('document.querySelectorAll(".artwork-card").length > 0');
  await evaluate('Array.from(document.querySelectorAll("app-cookie-banner button")).find(button => button.textContent.includes("Decline"))?.click()');
  await signIn('portal-demo-one');
  const title = 'Marketplace smoke ' + Date.now();
  const created = await api('/api/student/artworks', 'POST', { title, description: 'Local end-to-end test listing.',
    category: 'Print', price: 123.45, imageUrl: base + '/artworks/ocean-waves.svg' });
  assert.equal(created.status, 201);
  const id = created.data.id;
  const timings = {};
  await api('/api/auth/session', 'DELETE');
  await signIn('portal-demo-two');
  await navigate('/gallery');
  await wait('document.querySelectorAll(".artwork-card").length > 0');
  timings.catalogue_ms = await evaluate('performance.getEntriesByType("resource").filter(entry => entry.name.endsWith("/api/artworks")).at(-1)?.duration');
  await evaluate(`(() => { const input=document.querySelector('input[type=search]'); input.value=${JSON.stringify(title)}; input.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  await wait('document.querySelectorAll(".artwork-card").length === 1');
  await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await wait('document.querySelector(".artwork-card img")?.naturalWidth > 0');
  assert(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), 'Gallery overflows mobile viewport.');
  await screenshot('gallery-mobile');
  await navigate('/gallery/' + id);
  await wait('document.querySelector(".details img")?.naturalWidth > 0');
  assert(await evaluate('document.querySelector(".details h1")?.textContent === ' + JSON.stringify(title)));
  await screenshot('details-mobile');
  await wait('document.querySelector("app-add-to-cart button")?.disabled === false');
  await evaluate('document.querySelector("app-add-to-cart button").click()');
  await wait('document.querySelector("app-add-to-cart button")?.textContent.includes("Quantity limit reached")');
  timings.add_cart_ms = await evaluate('performance.getEntriesByType("resource").filter(entry => entry.name.endsWith("/api/cart/items")).at(-1)?.duration');
  await navigate('/gallery/cart');
  await wait('document.querySelectorAll(".cart-list li").length === 1');
  assert(await evaluate('document.querySelector(".price")?.textContent.includes("123.45")'));
  assert(await evaluate('document.querySelector("button[aria-label^=Increase]").disabled'));
  assert(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), 'Cart overflows mobile viewport.');
  await screenshot('cart-mobile');
  await command('Emulation.setDeviceMetricsOverride', { width: 1365, height: 900, deviceScaleFactor: 1, mobile: false });
  await screenshot('cart-desktop');
  await evaluate('Array.from(document.querySelectorAll("button")).find(b=>b.textContent.includes("Simulated checkout")).click()');
  await wait('Array.from(document.querySelectorAll("button")).some(b=>b.textContent.includes("Confirm demo order"))');
  await evaluate('Array.from(document.querySelectorAll("button")).find(b=>b.textContent.includes("Confirm demo order")).click()');
  await wait('document.body.textContent.includes("Demo checkout complete")');
  timings.checkout_ms = await evaluate('performance.getEntriesByType("resource").filter(entry => entry.name.endsWith("/api/cart/checkout")).at(-1)?.duration');
  await screenshot('checkout-desktop');
  assert.equal((await api('/api/cart')).data.lines.length, 0);
  assert(!(await api('/api/artworks')).data.some(item => item.id === id));
  assert.equal((await api('/api/cart/items', 'POST', { artworkId: id })).status, 409);
  await api('/api/auth/session', 'DELETE');
  await signIn('portal-demo-one');
  const sale = (await api('/api/student/sales')).data.sales.find(item => item.artworkId === id);
  assert.equal(sale.price, 123.45);
  assert.equal(sale.commission, 18.52);
  assert.equal(sale.earnings, 104.93);
  assert.equal(sale.payoutStatus, 'Pending');
  const csrf = await evaluate(`fetch('/api/cart/items',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},body:'{}'}).then(r=>r.status)`);
  assert.equal(csrf, 419, 'CSRF protection must reject an unprotected write.');
  assert.deepEqual(exceptions, [], 'Browser raised an uncaught runtime exception.');
  console.log('PASS: student creation, catalogue, details image, animated add, cart reload, unique quantity, mobile overflow, checkout, sold exclusion, sales/15% commission, CSRF.');
  console.log('Screenshots: __screenshots__/marketplace; uncaught browser exceptions: 0.');
  await writeFile('__screenshots__/marketplace/timings.json', JSON.stringify(timings, null, 2));
  console.log('Observed localhost resource timings (ms): ' + JSON.stringify(timings));
} finally {
  socket?.close();
  browser.kill();
}
