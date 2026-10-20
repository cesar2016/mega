// Inspector del DOM renderizado: encuentra los elementos que desbordan el
// viewport. Uso: node scripts/inspect.mjs <url> [ancho] [alto]
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { writeFileSync } from "node:fs";

const [, , url, widthArg, heightArg] = process.argv;
const width = Number(widthArg || 390);
const height = Number(heightArg || 844);
const PORT = 9444;

const chrome = spawn(
  "google-chrome",
  [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    `--remote-debugging-port=${PORT}`,
    `--window-size=${width},${height + 90}`,
    "about:blank",
  ],
  { stdio: "ignore" }
);

process.on("exit", () => chrome.kill());

async function waitForChrome() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) return;
    } catch {}
    await sleep(250);
  }
  throw new Error("Chrome no arrancó");
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    });
  }
  send(method, params = {}) {
    this.id += 1;
    const id = this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}

const EXPR = `(() => {
  const vw = document.documentElement.clientWidth;
  const out = [];
  document.querySelectorAll('*').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width > vw + 1 || r.right > vw + 1) {
      out.push({
        tag: el.tagName,
        cls: (el.className && el.className.baseVal !== undefined ? el.className.baseVal : String(el.className || '')).slice(0, 160),
        w: Math.round(r.width),
        right: Math.round(r.right),
        text: (el.textContent || '').trim().slice(0, 40),
      });
    }
  });
  const scrollers = [];
  document.querySelectorAll('*').forEach((el) => {
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
      scrollers.push({
        cls: (el.className && el.className.baseVal !== undefined ? el.className.baseVal : String(el.className || '')).slice(0, 120),
        clientW: el.clientWidth,
        scrollW: el.scrollWidth,
      });
    }
  });
  return JSON.stringify({ vw, scrollW: document.documentElement.scrollWidth, bodyW: document.body.scrollWidth, out: out.slice(0, 25), scrollers: scrollers.slice(0, 12) }, null, 1);
})()`;

async function main() {
  await waitForChrome();
  const res = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, {
    method: "PUT",
  });
  const target = await res.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.addEventListener("open", resolve));
  const cdp = new CDP(ws);

  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 768,
  });
  await cdp.send("Page.navigate", { url });
  await sleep(9000);

  const result = await cdp.send("Runtime.evaluate", {
    expression: process.env.INSPECT_EXPR || EXPR,
    returnByValue: true,
    awaitPromise: true,
  });
  console.log(result.result?.value ?? JSON.stringify(result));

  if (process.env.SHOT_OUT) {
    await sleep(Number(process.env.SHOT_DELAY || 1500));
    const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
    writeFileSync(process.env.SHOT_OUT, Buffer.from(data, "base64"));
    console.log("screenshot:", process.env.SHOT_OUT);
  }

  ws.close();
  chrome.kill();
}

main().catch((err) => {
  console.error("ERR", err.message);
  chrome.kill();
  process.exit(1);
});
