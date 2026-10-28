import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

async function waitForJson(url) {
  for (let attempt = 0; attempt < 80; attempt++) {
    try { const response = await fetch(url); if (response.ok) return await response.json(); } catch { /* Wait for Chrome startup. */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Browser did not become ready");
}
const info = await waitForJson("http://127.0.0.1:9222/json/version");
const socket = new WebSocket(info.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
let nextId = 0;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  const entry = pending.get(message.id);
  if (!entry) return;
  pending.delete(message.id);
  if (message.error) entry.reject(new Error(JSON.stringify(message.error))); else entry.resolve(message.result);
});
function send(method, params = {}, sessionId) {
  const id = ++nextId;
  return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); });
}
try {
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const call = (method, params) => send(method, params, sessionId);
  async function evaluate(expression) {
    const result = await call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
  await call("Page.enable");
  await call("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await call("Emulation.setDeviceMetricsOverride", { width: 1600, height: 1100, deviceScaleFactor: 1, mobile: false });
  await call("Page.navigate", { url: "http://127.0.0.1:4173/demo?view=cards" });
  await evaluate(`(async () => {
    const until = Date.now() + 20000;
    while (document.querySelectorAll('.credit-card-tile').length !== 2) {
      if (Date.now() > until) throw new Error('Cards did not render');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    await document.fonts.ready;
    await new Promise(resolve => setTimeout(resolve, 1000));
    return true;
  })()`);
  const probe = `(() => {
    const css = getComputedStyle(document.documentElement);
    const token = (name) => { const el = document.createElement('span'); el.style.color = css.getPropertyValue(name).trim(); document.body.append(el); const color = getComputedStyle(el).color; el.remove(); return color; };
    const rgb = (value) => value.match(/[\\d.]+/g).slice(0, 3).map(Number);
    const lum = (color) => rgb(color).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    const ratio = (a, b) => (Math.max(lum(a), lum(b)) + .05) / (Math.min(lum(a), lum(b)) + .05);
    const background = (el) => { for (let current = el; current; current = current.parentElement) { const c = getComputedStyle(current).backgroundColor; if (c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c; } return token('--background'); };
    for (const card of document.querySelectorAll('.credit-card-tile')) if (getComputedStyle(card).backgroundColor !== token('--card')) throw new Error('Card background does not follow the theme');
    const values = [...document.querySelectorAll('.credit-card-heading strong, .credit-card-select span, .credit-card-select small, .credit-card-select > strong, .credit-card-details dt, .credit-card-details dd, .invoice-totals dt, .invoice-totals dd, .card-filter select')].map(el => ({ text: el.textContent.trim(), contrast: ratio(getComputedStyle(el).color, background(el)) }));
    const failed = values.filter(x => x.contrast < 4.5);
    if (failed.length) throw new Error('Low contrast: ' + JSON.stringify(failed));
    if (document.documentElement.scrollWidth > innerWidth + 1) throw new Error('Page overflows horizontally');
    return { viewport: innerWidth, checkedLabels: values.length, minimumContrast: Math.min(...values.map(x => x.contrast)), cardBackground: token('--card'), selectedBackground: getComputedStyle(document.querySelector('.card-filter select')).backgroundColor };
  })()`;
  for (const [name, width, height, mobile] of [["desktop", 1600, 1100, false], ["mobile", 390, 844, true]]) {
    await call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
    await new Promise((resolve) => setTimeout(resolve, 400));
    console.log("ZELO_STYLE_CHECK:" + JSON.stringify({ name, ...await evaluate(probe) }));
    if (name === "desktop") {
      await evaluate(`(async () => { document.querySelector('.credit-card-select').click(); await new Promise(resolve => setTimeout(resolve, 100)); if (document.querySelectorAll('.card-invoice').length !== 1) throw new Error('Card selection failed'); document.querySelector('.credit-card-select').click(); await new Promise(resolve => setTimeout(resolve, 100)); if (document.querySelectorAll('.card-invoice').length !== 2) throw new Error('Card selection did not reset'); return true; })()`);
    }
    await evaluate("window.scrollTo(0, 0)");
    const { cssContentSize } = await call("Page.getLayoutMetrics");
    const fullHeight = Math.min(6000, Math.ceil(cssContentSize.height));
    const screenshot = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, fromSurface: true, clip: { x: 0, y: 0, width, height: fullHeight, scale: 1 } });
    const bytes = Buffer.from(screenshot.data, "base64");
    writeFileSync("/tmp/zelo-multicartoes-" + name + ".png", bytes);
    console.log("ZELO_STYLE_IMAGE_META:" + JSON.stringify({ name, width, height: fullHeight, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }));
    for (let i = 0; i < screenshot.data.length; i += 4096) console.log("ZELO_STYLE_IMAGE_CHUNK:" + name + ":" + String(i / 4096).padStart(5, "0") + ":" + screenshot.data.slice(i, i + 4096));
  }
} finally { socket.close(); }
