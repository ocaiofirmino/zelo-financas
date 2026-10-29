import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

async function waitForJson(url) {
  for (let attempt = 0; attempt < 80; attempt++) {
    try { const response = await fetch(url); if (response.ok) return await response.json(); } catch {}
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
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}
try {
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const call = (method, params) => send(method, params, sessionId);
  await call("Page.enable");
  await call("Emulation.setDeviceMetricsOverride", { width: 1600, height: 1100, deviceScaleFactor: 1, mobile: false });
  await call("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await call("Page.navigate", { url: "http://127.0.0.1:4173/demo?view=cards" });
  const ready = await call("Runtime.evaluate", {
    expression: `(async () => {
      const until = Date.now() + 20000;
      while (document.querySelectorAll('.credit-card-tile').length !== 2) {
        if (Date.now() > until) throw new Error('Cards did not render: ' + document.body.innerText.slice(0, 500));
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      await document.fonts.ready;
      await new Promise(resolve => setTimeout(resolve, 1200));
      window.scrollTo(0, 0);
      return { cards: document.querySelectorAll('.credit-card-tile').length, invoices: document.querySelectorAll('.card-invoice').length, title: document.title };
    })()`, awaitPromise: true, returnByValue: true,
  });
  if (ready.exceptionDetails) throw new Error(JSON.stringify(ready.exceptionDetails));
  const { cssContentSize } = await call("Page.getLayoutMetrics");
  const width = 1600;
  const height = Math.min(5000, Math.ceil(cssContentSize.height));
  const screenshot = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, fromSurface: true, clip: { x: 0, y: 0, width, height, scale: 1 } });
  const bytes = Buffer.from(screenshot.data, "base64");
  writeFileSync("/tmp/zelo-multicartoes.png", bytes);
  console.log("ZELO_SCREENSHOT_META:" + JSON.stringify({ width, height, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), rendered: ready.result.value, source: process.env.ZELO_SOURCE_SHA }));
  for (let i = 0; i < screenshot.data.length; i += 4096) console.log("ZELO_SCREENSHOT_CHUNK:" + String(i / 4096).padStart(5, "0") + ":" + screenshot.data.slice(i, i + 4096));
} finally { socket.close(); }
