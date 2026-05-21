import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const F5AI = "https://api.f5ai.ru/v2/chat/completions";

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
const pendingText = new Map();

function loadJson(file) {
  const p = path.join(ROOT, file);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

const botCfg = loadJson("bot.local.json");
const f5Cfg = loadJson("config.local.json");

const TOKEN = botCfg?.telegramToken || process.env.TELEGRAM_BOT_TOKEN;
const WEB_APP = (botCfg?.webAppUrl || "https://symphonious-blini-b9c326.netlify.app").replace(/\/$/, "");
const F5AI_KEY = f5Cfg?.apiKey || process.env.F5AI_API_KEY;
const F5AI_MODEL = f5Cfg?.model || process.env.F5AI_MODEL || "gpt-4o";

if (!TOKEN) {
  console.error("Нет токена бота. Создайте bot.local.json");
  process.exit(1);
}

const API = `https://api.telegram.org/bot${TOKEN}`;

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function modeById(id) {
  return MODES.find((m) => m.id === id);
}

function modeByLabel(label) {
  return MODES.find((m) => m.label === label);
}

function getMode(chatId) {
  return userMode.get(chatId) || MODES[0];
}

function mainMenuHtml() {
  const rows = MODES.map(
    (m) => `${m.icon} <b>${m.label}</b>\n<i>${m.desc}</i>`
  ).join("\n\n");
  return (
    `<b>Text Fix</b>\n` +
    `<i>Умная правка текста · F5AI</i>\n\n` +
    `${rows}\n\n` +
    `▸ Отправьте текст сообщением\n` +
    `▸ Затем выберите режим кнопками под сообщением`
  );
}

function modesInline() {
  return {
    inline_keyboard: [
      [
        { text: "✏️ Грамматика", callback_data: "mode:grammar" },
        { text: "✨ Стиль", callback_data: "mode:style" },
      ],
      [{ text: "💼 Деловой", callback_data: "mode:formal" }],
      [
        { text: "🌐 Mini App", web_app: { url: WEB_APP } },
        { text: "🔗 В браузере", url: WEB_APP },
      ],
    ],
  };
}

async function tg(method, body = {}) {
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.description || `Telegram ${method} failed`);
  return data.result;
}

async function sendHtml(chatId, text, extra = {}) {
  return tg("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...extra,
  });
}

async function setup() {
  for (;;) {
    try {
      await tg("setMyCommands", {
        commands: [
          { command: "start", description: "Главное меню" },
          { command: "help", description: "Как пользоваться" },
          { command: "app", description: "Открыть сайт" },
        ],
      });
      await tg("setChatMenuButton", {
        menu_button: {
          type: "web_app",
          text: "Text Fix",
          web_app: { url: WEB_APP },
        },
      });
      console.log("Бот готов → @Foto_Kooperinstitutbot");
      return;
    } catch (e) {
      console.error("Telegram:", e.message, "— повтор 10 сек");
      await new Promise((r) => setTimeout(r, 10000));
    }
  }
}

async function askF5AI(userMessage, instructions) {
  const res = await fetch(F5AI, {
    method: "POST",
    headers: { "X-Auth-Token": F5AI_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: F5AI_MODEL,
      instructions,
      messages: [{ role: "user", content: userMessage }],
      max_tokens: 2000,
      temperature: 0.3,
    }),
    signal: AbortSignal.timeout(90000),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || data?.error || "F5AI error");
  return data?.message?.content?.trim() || null;
}

async function showMainMenu(chatId) {
  await tg("sendMessage", {
    chat_id: chatId,
    text: "\u200b",
    reply_markup: { remove_keyboard: true },
  });
  await sendHtml(chatId, mainMenuHtml(), { reply_markup: modesInline() });
}

async function showHelp(chatId) {
  await sendHtml(
    chatId,
    `<b>Как пользоваться</b>\n\n` +
      `1️⃣ Выберите режим: <b>Грамматика</b>, <b>Стиль</b> или <b>Деловой</b>\n` +
      `2️⃣ Отправьте текст одним сообщением\n` +
      `3️⃣ Получите исправленный вариант\n\n` +
      `Можно наоборот: сначала текст → потом кнопка режима.\n\n` +
      `🌐 Сайт с теми же режимами: <a href="${WEB_APP}">Text Fix</a>`,
    { reply_markup: modesInline() }
  );
}

function resultHtml(mode, fixed) {
  return (
    `${mode.icon} <b>${esc(mode.label)}</b> · готово\n\n` +
    `<pre>${esc(fixed)}</pre>\n\n` +
    `<i>Отправьте новый текст или смените режим</i>`
  );
}

async function fixText(chatId, text, mode) {
  const waitMsg = await sendHtml(chatId, `${mode.icon} <b>${esc(mode.label)}</b>\n<i>Исправляю текст…</i>`);
  await tg("sendChatAction", { chat_id: chatId, action: "typing" });

  const fixed = await askF5AI(text, mode.text);
  await tg("editMessageText", {
    chat_id: chatId,
    message_id: waitMsg.message_id,
    text: resultHtml(mode, fixed),
    parse_mode: "HTML",
    reply_markup: modesInline(),
  });
}

async function handleCallback(cb) {
  const chatId = cb.message?.chat?.id;
  const messageId = cb.message?.message_id;
  const data = cb.data || "";

  if (!data.startsWith("mode:")) return;

  const mode = modeById(data.slice(5));
  if (!mode || !chatId) return;

  userMode.set(chatId, mode);
  await tg("answerCallbackQuery", {
    callback_query_id: cb.id,
    text: `Режим: ${mode.label}`,
  });

  const queued = pendingText.get(chatId);
  if (!queued) {
    if (messageId) {
      await tg("editMessageReplyMarkup", {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: modesInline(),
      });
    }
    await sendHtml(
      chatId,
      `${mode.icon} <b>${esc(mode.label)}</b>\n<i>${esc(mode.desc)}</i>\n\nТеперь отправьте текст 👇`
    );
    return;
  }

  pendingText.delete(chatId);
  try {
    await fixText(chatId, queued, mode);
  } catch (e) {
    await sendHtml(chatId, `❌ <b>Ошибка</b>\n${esc(e.message)}`, { reply_markup: modesInline() });
  }
}

function labelFromButton(text) {
  return MODES.find((m) => text.includes(m.label)) || modeByLabel(text.replace(/^[^\s]+\s/, ""));
}

async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const text = (msg.text || "").trim();

  if (text === "/start") {
    userMode.set(chatId, MODES[0]);
    pendingText.delete(chatId);
    await showMainMenu(chatId);
    return;
  }

  if (text === "/help") {
    await showHelp(chatId);
    return;
  }

  if (text === "/app") {
    await sendHtml(chatId, `🌐 <b>Text Fix</b>\nОткройте мини-приложение:`, {
      reply_markup: {
        inline_keyboard: [[{ text: "🌐 Открыть Text Fix", web_app: { url: WEB_APP } }]],
      },
    });
    return;
  }

  const picked = labelFromButton(text) || modeByLabel(text);
  if (picked) {
    userMode.set(chatId, picked);
    const queued = pendingText.get(chatId);
    if (queued) {
      pendingText.delete(chatId);
      try {
        await fixText(chatId, queued, picked);
      } catch (e) {
        await sendHtml(chatId, `❌ <b>Ошибка</b>\n${esc(e.message)}`, { reply_markup: modesInline() });
      }
      return;
    }
    await sendHtml(
      chatId,
      `${picked.icon} <b>${esc(picked.label)}</b>\n<i>${esc(picked.desc)}</i>\n\nЖду ваш текст 👇`
    );
    return;
  }

  if (!text || text.startsWith("/")) {
    await sendHtml(chatId, `Команды: /start · /help · /app`);
    return;
  }

  if (!F5AI_KEY) {
    await sendHtml(
      chatId,
      `⚠️ Нет ключа F5AI.\nДобавьте в <code>config.local.json</code> или откройте сайт:`,
      { reply_markup: modesInline() }
    );
    return;
  }

  pendingText.set(chatId, text);
  const mode = getMode(chatId);
  await sendHtml(
    chatId,
    `📩 Текст получен (${text.length} симв.)\n\n` +
      `Выберите тип правки · сейчас: ${mode.icon} <b>${esc(mode.label)}</b>`,
    { reply_markup: modesInline() }
  );
}

async function pollOnce(offset = 0) {
  const updates = await tg("getUpdates", { offset, timeout: 50 });
  let next = offset;
  for (const u of updates) {
    next = u.update_id + 1;
    if (u.callback_query) await handleCallback(u.callback_query);
    if (u.message) await handleMessage(u.message);
  }
  return next;
}

await setup();
let offset = 0;
for (;;) {
  try {
    offset = await pollOnce(offset);
  } catch (e) {
    console.error("Сеть:", e.message, "— повтор 10 сек");
    await new Promise((r) => setTimeout(r, 10000));
  }
}
