const F5AI = "https://api.f5ai.ru/v2/chat/completions";
const cors = { "Access-Control-Allow-Origin": "*" };

const MODES = [
  {
    id: "grammar",
    icon: "✏️",
    label: "Грамматика",
    desc: "Орфография, пунктуация и опечатки. Смысл и тон сохраняются.",
    text: "Исправь орфографию и пунктуацию. Верни только исправленный текст.",
  },
  {
    id: "style",
    icon: "✨",
    label: "Стиль",
    desc: "Убирает воду, повторы и канцелярит. Текст яснее и короче.",
    text: "Улучши стиль: убери воду и повторы. Верни только исправленный текст.",
  },
  {
    id: "formal",
    icon: "💼",
    label: "Деловой",
    desc: "Вежливый официальный тон для писем, заявлений и работы.",
    text: "Перепиши в вежливом деловом стиле. Верни только исправленный текст.",
  },
];

const userMode = new Map();

const json = (status, body) => ({
  statusCode: status,
  headers: { ...cors, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

function env(name) {
  return process.env[name] || "";
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function modeById(id) {
  return MODES.find((m) => m.id === id);
}

function modeByLabel(text) {
  return MODES.find((m) => text.includes(m.label));
}

function getMode(chatId) {
  return userMode.get(chatId) || MODES[0];
}

function modesInline() {
  const webApp = (env("WEB_APP_URL") || "https://symphonious-blini-b9c326.netlify.app").replace(/\/$/, "");
  return {
    inline_keyboard: [
      [
        { text: "✏️ Грамматика", callback_data: "mode:grammar" },
        { text: "✨ Стиль", callback_data: "mode:style" },
      ],
      [{ text: "💼 Деловой", callback_data: "mode:formal" }],
      [
        { text: "🌐 Mini App", web_app: { url: webApp } },
        { text: "🔗 В браузере", url: webApp },
      ],
    ],
  };
}

function modesInlineFix() {
  return {
    inline_keyboard: [
      [
        { text: "✏️ Грамматика", callback_data: "fix:grammar" },
        { text: "✨ Стиль", callback_data: "fix:style" },
      ],
      [{ text: "💼 Деловой", callback_data: "fix:formal" }],
    ],
  };
}

function mainMenuHtml() {
  const rows = MODES.map((m) => `${m.icon} <b>${m.label}</b>\n<i>${m.desc}</i>`).join("\n\n");
  return (
    `<b>Text Fix</b>\n` +
    `<i>Умная правка текста · F5AI</i>\n\n` +
    `${rows}\n\n` +
    `▸ Отправьте текст сообщением\n` +
    `▸ Затем выберите режим кнопками под сообщением`
  );
}

function resultHtml(mode, fixed) {
  return (
    `${mode.icon} <b>${esc(mode.label)}</b> · готово\n\n` +
    `<pre>${esc(fixed)}</pre>\n\n` +
    `<i>Отправьте новый текст или смените режим</i>`
  );
}

async function tg(token, method, body = {}) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25000),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.description || `Telegram ${method} failed`);
  return data.result;
}

async function sendHtml(token, chatId, text, extra = {}) {
  return tg(token, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...extra,
  });
}

async function askF5AI(apiKey, model, userMessage, instructions) {
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
    signal: AbortSignal.timeout(24000),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || data?.error || "F5AI error");
  return data?.message?.content?.trim() || null;
}

async function fixText(token, f5Key, f5Model, chatId, text, mode) {
  const waitMsg = await sendHtml(
    token,
    chatId,
    `${mode.icon} <b>${esc(mode.label)}</b>\n<i>Исправляю текст…</i>`
  );
  await tg(token, "sendChatAction", { chat_id: chatId, action: "typing" });
  const fixed = await askF5AI(f5Key, f5Model, text, mode.text);
  await tg(token, "editMessageText", {
    chat_id: chatId,
    message_id: waitMsg.message_id,
    text: resultHtml(mode, fixed),
    parse_mode: "HTML",
    reply_markup: modesInline(),
  });
}

async function showMainMenu(token, chatId) {
  await tg(token, "sendMessage", {
    chat_id: chatId,
    text: "\u200b",
    reply_markup: { remove_keyboard: true },
  });
  await sendHtml(token, chatId, mainMenuHtml(), { reply_markup: modesInline() });
}

async function showHelp(token, chatId) {
  const webApp = (env("WEB_APP_URL") || "https://symphonious-blini-b9c326.netlify.app").replace(/\/$/, "");
  await sendHtml(
    token,
    chatId,
    `<b>Как пользоваться</b>\n\n` +
      `1️⃣ Отправьте текст\n` +
      `2️⃣ Нажмите режим под вашим сообщением\n\n` +
      `🌐 Сайт: <a href="${webApp}">Text Fix</a>`,
    { reply_markup: modesInline() }
  );
}

async function handleCallback(token, f5Key, f5Model, cb) {
  const chatId = cb.message?.chat?.id;
  const data = cb.data || "";
  if (!chatId || !data) return;

  if (data.startsWith("fix:")) {
    const mode = modeById(data.slice(4));
    const text = cb.message?.reply_to_message?.text?.trim();
    if (!mode) return;
    await tg(token, "answerCallbackQuery", {
      callback_query_id: cb.id,
      text: text ? `Режим: ${mode.label}` : "Сначала отправьте текст",
    });
    if (!text) return;
    try {
      await fixText(token, f5Key, f5Model, chatId, text, mode);
    } catch (e) {
      await sendHtml(token, chatId, `❌ <b>Ошибка</b>\n${esc(e.message)}`, {
        reply_markup: modesInline(),
      });
    }
    return;
  }

  if (!data.startsWith("mode:")) return;

  const mode = modeById(data.slice(5));
  if (!mode) return;

  userMode.set(chatId, mode);
  await tg(token, "answerCallbackQuery", {
    callback_query_id: cb.id,
    text: `Режим: ${mode.label}`,
  });

  const text = cb.message?.reply_to_message?.text?.trim();
  if (text) {
    try {
      await fixText(token, f5Key, f5Model, chatId, text, mode);
    } catch (e) {
      await sendHtml(token, chatId, `❌ <b>Ошибка</b>\n${esc(e.message)}`, {
        reply_markup: modesInline(),
      });
    }
    return;
  }

  await sendHtml(
    token,
    chatId,
    `${mode.icon} <b>${esc(mode.label)}</b>\n<i>${esc(mode.desc)}</i>\n\nТеперь отправьте текст 👇`
  );
}

async function handleMessage(token, f5Key, f5Model, msg) {
  const chatId = msg.chat.id;
  const text = (msg.text || "").trim();

  if (text === "/start") {
    userMode.set(chatId, MODES[0]);
    await showMainMenu(token, chatId);
    return;
  }

  if (text === "/help") {
    await showHelp(token, chatId);
    return;
  }

  if (text === "/app") {
    const webApp = (env("WEB_APP_URL") || "https://symphonious-blini-b9c326.netlify.app").replace(/\/$/, "");
    await sendHtml(token, chatId, `🌐 <b>Text Fix</b>\nОткройте мини-приложение:`, {
      reply_markup: {
        inline_keyboard: [[{ text: "🌐 Открыть Text Fix", web_app: { url: webApp } }]],
      },
    });
    return;
  }

  const picked = modeByLabel(text);
  if (picked) {
    userMode.set(chatId, picked);
    await sendHtml(
      token,
      chatId,
      `${picked.icon} <b>${esc(picked.label)}</b>\n<i>${esc(picked.desc)}</i>\n\nЖду ваш текст 👇`
    );
    return;
  }

  if (!text || text.startsWith("/")) {
    await sendHtml(token, chatId, `Команды: /start · /help · /app`);
    return;
  }

  if (!f5Key) {
    await sendHtml(token, chatId, `⚠️ На Netlify задайте F5AI_API_KEY и сделайте redeploy.`, {
      reply_markup: modesInline(),
    });
    return;
  }

  const mode = getMode(chatId);
  await sendHtml(
    token,
    chatId,
    `📩 Текст получен (${text.length} симв.)\n\nНажмите режим под этим сообщением:`,
    {
      reply_markup: modesInlineFix(),
      reply_to_message_id: msg.message_id,
    }
  );
}

function siteUrl(event) {
  const fromEnv = env("URL") || env("DEPLOY_PRIME_URL");
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const host = event.headers?.host || event.headers?.Host;
  return host ? `https://${host}` : "";
}

async function installWebhook(token, event) {
  const base = siteUrl(event);
  const webhookUrl = `${base}/api/telegram`;
  const secret = env("TELEGRAM_WEBHOOK_SECRET");
  const body = {
    url: webhookUrl,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  };
  if (secret) body.secret_token = secret;

  await tg(token, "setWebhook", body);
  await tg(token, "setMyCommands", {
    commands: [
      { command: "start", description: "Главное меню" },
      { command: "help", description: "Как пользоваться" },
      { command: "app", description: "Открыть сайт" },
    ],
  });
  const webApp = env("WEB_APP_URL") || base;
  await tg(token, "setChatMenuButton", {
    menu_button: { type: "web_app", text: "Text Fix", web_app: { url: webApp } },
  });

  return { webhookUrl, webApp };
}

export async function handler(event) {
  try {
    const token = env("TELEGRAM_BOT_TOKEN") || env("TELEGRAM_TOKEN");
    const f5Key = env("F5AI_API_KEY") || env("F5AI_KEY");
    const f5Model = env("F5AI_MODEL") || "gpt-4o";
    const setupSecret = env("TELEGRAM_SETUP_SECRET");

    if (event.httpMethod === "GET") {
      const key = event.queryStringParameters?.setup || "";
      if (!setupSecret || key !== setupSecret) {
        return json(403, { error: "forbidden", hint: "Задайте TELEGRAM_SETUP_SECRET в Netlify" });
      }
      if (!token) return json(500, { error: "missing_token", hint: "TELEGRAM_BOT_TOKEN в Netlify" });
      const info = await installWebhook(token, event);
      return json(200, { ok: true, ...info });
    }

    if (event.httpMethod !== "POST") return json(405, { error: "method_not_allowed" });

    const webhookSecret = env("TELEGRAM_WEBHOOK_SECRET");
    const headerSecret =
      event.headers["x-telegram-bot-api-secret-token"] ||
      event.headers["X-Telegram-Bot-Api-Secret-Token"];
    if (webhookSecret && headerSecret !== webhookSecret) {
      return json(403, { error: "invalid_secret" });
    }

    if (!token) return json(500, { error: "missing_token" });

    let update;
    try {
      update = JSON.parse(event.body || "{}");
    } catch {
      return json(400, { error: "invalid_json" });
    }

    if (update.callback_query) await handleCallback(token, f5Key, f5Model, update.callback_query);
    if (update.message) await handleMessage(token, f5Key, f5Model, update.message);

    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: "function_crash", message: e.message });
  }
}
