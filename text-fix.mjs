const F5AI = "https://api.f5ai.ru/v2/chat/completions";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" };

const json = (status, body) => ({
  statusCode: status,
  headers: { ...cors, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

function readEnv(name) {
  return process.env[name] || "";
}

export async function handler(event) {
  try {
    if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };
    if (event.httpMethod !== "POST") return json(405, { error: "method_not_allowed" });

    const apiKey = readEnv("F5AI_API_KEY") || readEnv("F5AI_KEY");
    if (!apiKey) {
      return json(500, {
        error: "config_missing",
        message: "Задайте F5AI_API_KEY в Netlify (Scopes: Functions + Builds)",
      });
    }

    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return json(400, { error: "invalid_json" });
    }

    const instructions = String(body.instructions || "").trim();
    const userMessage = String(body.userMessage || "").trim();
    if (!instructions || !userMessage) return json(400, { error: "missing_fields" });

    const model = readEnv("F5AI_MODEL") || "gpt-4o";

    const res = await fetch(F5AI, {
      method: "POST",
      headers: { "X-Auth-Token": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        instructions,
        messages: [{ role: "user", content: userMessage }],
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return json(res.status, { error: "f5ai_error", message: data?.message || data?.error });
    }

    const content = data?.message?.content?.trim();
    if (!content) return json(502, { error: "empty_response" });

    return json(200, { content, model: data?.model || model });
  } catch (e) {
    return json(500, { error: "function_crash", message: e.message });
  }
}
