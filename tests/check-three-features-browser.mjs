import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

// Runs against the isolated, fictitious-data build prepared by CI, never production.
async function browserInfo() {
  for (let i = 0; i < 100; i++) {
    try {
      const response = await fetch("http://127.0.0.1:9222/json/version");
      if (response.ok) return await response.json();
    } catch {
      /* Chrome is starting. */
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Chrome did not start");
}
const info = await browserInfo();
const socket = new WebSocket(info.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});
let nextId = 0;
const pending = new Map();
const errors = [];
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.method === "Runtime.exceptionThrown")
    errors.push(message.params.exceptionDetails);
  const entry = pending.get(message.id);
  if (!entry) return;
  pending.delete(message.id);
  if (message.error) entry.reject(new Error(JSON.stringify(message.error)));
  else entry.resolve(message.result);
});
function send(method, params = {}, sessionId) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(
      JSON.stringify({
        id,
        method,
        params,
        ...(sessionId ? { sessionId } : {}),
      }),
    );
  });
}
mkdirSync("/tmp/zelo-three-features", { recursive: true });
try {
  const { targetId } = await send("Target.createTarget", {
    url: "about:blank",
  });
  const { sessionId } = await send("Target.attachToTarget", {
    targetId,
    flatten: true,
  });
  const call = (method, params) => send(method, params, sessionId);
  async function evaluate(expression) {
    const result = await call("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails)
      throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
  const pause = () => new Promise((resolve) => setTimeout(resolve, 250));
  async function until(expression) {
    for (let i = 0; i < 100; i++) {
      if (await evaluate(expression)) return;
      await pause();
    }
    throw new Error(
      "UI did not reach expected state: " +
        expression +
        "\n" +
        (await evaluate("document.body.innerText.slice(-1800)")),
    );
  }
  async function click(selector) {
    await until(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
    await evaluate(
      `document.querySelector(${JSON.stringify(selector)}).click()`,
    );
    await pause();
  }
  async function select(selector, value) {
    await evaluate(
      `(() => { const node = document.querySelector(${JSON.stringify(selector)}); if (!node) throw new Error('Select missing'); node.value = ${JSON.stringify(value)}; node.dispatchEvent(new Event('change', { bubbles: true })); })()`,
    );
    await pause();
  }
  async function text(selector, value) {
    await evaluate(
      `(() => { const node = document.querySelector(${JSON.stringify(selector)}); node.focus(); node.select(); })()`,
    );
    await call("Input.insertText", { text: value });
    await pause();
  }
  async function screenshot(name, fullPage = false) {
    await evaluate("window.scrollTo(0, 0)");
    await pause();
    const metrics = await call("Page.getLayoutMetrics");
    const width = 1600;
    const height = fullPage
      ? Math.min(5000, Math.ceil(metrics.cssContentSize.height))
      : 1100;
    const result = await call("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true,
      fromSurface: true,
      clip: { x: 0, y: 0, width, height, scale: 1 },
    });
    const bytes = Buffer.from(result.data, "base64");
    writeFileSync(`/tmp/zelo-three-features/${name}.png`, bytes);
    console.log(
      "ZELO_THREE_IMAGE_META:" +
        JSON.stringify({
          name,
          width,
          height,
          bytes: bytes.length,
          sha256: createHash("sha256").update(bytes).digest("hex"),
        }),
    );
    if (process.env.ZELO_EXPORT_PRINTS === "1")
      for (let i = 0; i < result.data.length; i += 4096)
        console.log(
          "ZELO_THREE_IMAGE_CHUNK:" +
            name +
            ":" +
            String(i / 4096).padStart(5, "0") +
            ":" +
            result.data.slice(i, i + 4096),
        );
  }
  await call("Page.enable");
  await call("Runtime.enable");
  await call("Emulation.setDeviceMetricsOverride", {
    width: 1600,
    height: 1100,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await call("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  await call("Page.addScriptToEvaluateOnNewDocument", {
    source: `localStorage.setItem('folga-data-mode', 'demo'); window.__zeloTestWrites = 0; const original = window.fetch.bind(window); window.fetch = (input, init = {}) => { const url = new URL(typeof input === 'string' ? input : input.url, location.href); if (url.pathname.startsWith('/api/')) { if ((init.method || 'GET') !== 'GET') { window.__zeloTestWrites++; return Promise.reject(new Error('Test tried to write to an API')); } return Promise.resolve(new Response(JSON.stringify({ transactions: [], settings: {}, cards: [] }), { headers: { 'Content-Type': 'application/json' } })); } return original(input, init); };`,
  });
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch("http://127.0.0.1:4173/demo?view=cards")).ok) break;
    } catch {
      /* Preview server is starting. */
    }
    await pause();
  }
  await call("Page.navigate", { url: "http://127.0.0.1:4173/demo?view=cards" });
  await until(
    "document.querySelectorAll('.credit-card-tile').length === 2 && [...document.querySelectorAll('.card-page-actions button')].some(node => node.textContent.includes('Vincular compras antigas'))",
  );
  await evaluate("document.fonts.ready.then(() => true)");
  await evaluate(
    "[...document.querySelectorAll('.credit-card-tile')].find(node => node.querySelector('strong').textContent === 'Meu cartão').querySelector('.card-archive-action button').click()",
  );
  await until("Boolean(document.querySelector('[role=dialog]'))");
  assert.ok(
    await evaluate(
      "document.querySelector('[role=dialog]').textContent.includes('parcelas futuras')",
    ),
  );
  await click("[role=dialog] .primary-button");
  await until(
    "!document.querySelector('[role=dialog]') && document.querySelectorAll('.credit-card-tile').length === 1",
  );
  await click(".card-archive-tabs button:last-child");
  await until("document.querySelectorAll('.credit-card-tile').length === 2");
  assert.ok(
    await evaluate(
      "[...document.querySelectorAll('.credit-card-tile')].every(node => node.dataset.archived === 'true')",
    ),
  );
  assert.ok(
    await evaluate(
      "[...document.querySelectorAll('.card-invoice')].some(node => node.textContent.includes('Streaming'))",
    ),
  );
  await screenshot("cartoes-arquivados");
  await evaluate(
    "[...document.querySelectorAll('.credit-card-tile')].find(node => node.querySelector('strong').textContent === 'Meu cartão').querySelector('.card-archive-action button').click()",
  );
  await click("[role=dialog] .primary-button");
  await until(
    "!document.querySelector('[role=dialog]') && document.querySelectorAll('.credit-card-tile').length === 1",
  );
  await click(".card-archive-tabs button:first-child");
  await until("document.querySelectorAll('.credit-card-tile').length === 2");

  await click('button[aria-label="Editar Tênis"]');
  await select('[data-operation-scope="edit"] select', "all");
  assert.ok(
    await evaluate(
      "(() => { const rect = document.querySelector('.finance-drawer').getBoundingClientRect(); return rect.top >= -1 && rect.bottom <= innerHeight + 1 && rect.left >= -1 && rect.right <= innerWidth + 1; })()",
    ),
    "O formulário lateral deve ficar inteiro dentro da tela.",
  );
  await text('.finance-drawer input[maxlength="100"]', "Tênis revisado");
  assert.ok(
    await evaluate(
      "document.querySelector('[data-operation-scope=edit]').textContent.includes('3 parcelas selecionadas')",
    ),
  );
  await screenshot("parcelas-em-grupo");
  await click("[role=dialog] form .primary-button");
  await until(
    "!document.querySelector('[role=dialog]') && Boolean(document.querySelector('button[aria-label=\"Editar Tênis revisado\"]'))",
  );
  await click('button[aria-label="Próximo mês"]');
  await until(
    "Boolean(document.querySelector('button[aria-label=\"Editar Tênis revisado\"]'))",
  );
  await click('button[aria-label="Mês anterior"]');
  await click('button[aria-label="Mês anterior"]');
  await until(
    "Boolean(document.querySelector('button[aria-label=\"Editar Tênis revisado\"]'))",
  );
  await click('button[aria-label="Próximo mês"]');
  await click('button[aria-label="Excluir Tênis revisado"]');
  await select('[data-operation-scope="delete"] select', "following");
  assert.ok(
    await evaluate(
      "document.querySelector('[data-operation-scope=delete]').textContent.includes('2 parcelas selecionadas')",
    ),
  );
  await screenshot("excluir-parcelas-em-grupo");
  await click("[role=dialog] .danger-button");
  await until(
    "!document.querySelector('[role=dialog]') && !document.querySelector('button[aria-label=\"Editar Tênis revisado\"]')",
  );
  await click('button[aria-label="Mês anterior"]');
  await until(
    "Boolean(document.querySelector('button[aria-label=\"Editar Tênis revisado\"]'))",
  );
  await click('button[aria-label="Próximo mês"]');

  await click(".card-page-actions button.secondary-button");
  await until("Boolean(document.querySelector('.bulk-link-dialog'))");
  await select(".bulk-link-dialog select", "demo-card-compras");
  await click('input[aria-label="Selecionar Compra antiga - papelaria"]');
  await click('input[aria-label="Selecionar Assinatura antiga"]');
  assert.equal(
    await evaluate(
      "document.querySelectorAll('.bulk-link-dialog input:checked').length",
    ),
    2,
  );
  await screenshot("vincular-compras-em-lote");
  await click(".bulk-link-dialog button[type=submit]");
  await until(
    "!document.querySelector('[role=dialog]') && document.querySelector('.card-page-actions .card-count')?.textContent === '1'",
  );
  const linked = await evaluate(
    `(() => { const invoice = [...document.querySelectorAll('.card-invoice')].find(node => node.querySelector('h2').textContent === 'Cartão de compras'); return ['Compra antiga - papelaria', 'Assinatura antiga'].map(name => [...invoice.querySelectorAll('tbody tr')].find(row => row.textContent.includes(name))?.textContent); })()`,
  );
  assert.ok(linked[0]?.includes("85,00"));
  assert.ok(linked[1]?.includes("49,00"));
  assert.ok(linked[0]?.includes("Pago"));
  assert.ok(linked[1]?.includes("Previsto"));
  await call("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await pause();
  assert.ok(
    await evaluate("document.documentElement.scrollWidth <= innerWidth + 1"),
  );
  await click(".card-page-actions button.secondary-button");
  assert.ok(
    await evaluate(
      "(() => { const rect = document.querySelector('.bulk-link-dialog').getBoundingClientRect(); return rect.left >= -1 && rect.right <= innerWidth + 1; })()",
    ),
  );
  assert.equal(await evaluate("window.__zeloTestWrites"), 0);
  assert.deepEqual(errors, []);
  console.log(
    "OK: arquivar/restaurar preserva faturas; edição em grupo aparece nos meses anterior e seguinte; exclusão das próximas preserva a anterior; vínculo em lote preserva valores e situações; layout móvel e ausência de chamadas de gravação reais conferidos.",
  );
} finally {
  socket.close();
}
