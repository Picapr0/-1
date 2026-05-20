import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CERT = path.join(ROOT, "certs", "localhost.pfx");
const F5AI = "https://api.f5ai.ru/v2/chat/completions";
const PORT = 8443;

const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };

function loadConfig() {
  if (process.env.F5AI_API_KEY) {
    return { apiKey: process.env.F5AI_API_KEY, model: process.env.F5AI_MODEL || "gpt-4o" };
  }
  const p = path.join(ROOT, "config.local.json");
  if (!fs.existsSync(p)) return null;
  try {
    const j = JSON.parse(fs.readFileSync(p, "utf8"));
    return j.apiKey ? { apiKey: j.apiKey, model: j.model || "gpt-4o" } : null;
  } catch {
    return null;
  }
}

function json(res, code, body) {
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function api(req, res) {
  const cfg = loadConfig();
  if (!cfg) return json(res, 500, { error: "config_missing", message: "Нужен config.local.json" });

  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    return json(res, 400, { error: "invalid_json" });
  }

  const instructions = String(body.instructions || "").trim();
  const userMessage = String(body.userMessage || "").trim();
  if (!instructions || !userMessage) return json(res, 400, { error: "missing_fields" });

  try {
    const up = await fetch(F5AI, {
      method: "POST",
      headers: { "X-Auth-Token": cfg.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: cfg.model,
        instructions,
        messages: [{ role: "user", content: userMessage }],
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });
    const data = await up.json();
    if (!up.ok) return json(res, up.status, { error: "f5ai_error", message: data?.message || data?.error });
    return json(res, 200, { content: data?.message?.content || "", model: data?.model });
  } catch (e) {
    return json(res, 502, { error: "network_error", message: e.message });
  }
}

function staticFile(req, res) {
  const rel = decodeURIComponent((req.url || "/").split("?")[0]);
  const file = path.normalize(path.join(ROOT, rel === "/" ? "index.html" : rel));
  if (!file.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end();
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(err.code === "ENOENT" ? 404 : 500);
      return res.end();
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
}

function onRequest(req, res) {
  if (req.method === "POST" && req.url === "/api/text") return api(req, res);
  return staticFile(req, res);
}

if (!fs.existsSync(CERT)) {
  console.error("Нет сертификата. Запустите start-https.ps1");
  process.exit(1);
}

https
  .createServer({ pfx: fs.readFileSync(CERT), passphrase: "prompt-studio" }, onRequest)
  .listen(PORT, "127.0.0.1", () => {
    console.log(`https://localhost:${PORT}`);
    console.log(loadConfig() ? "F5AI: OK" : "F5AI: нет ключа в config.local.json");
  });
