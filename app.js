const MODES = [
  {
    id: "grammar",
    title: "Грамматика",
    desc: "Орфография, пунктуация, опечатки. Смысл и тон не меняются.",
    text: "Исправь орфографию и пунктуацию. Верни только исправленный текст.",
  },
  {
    id: "style",
    title: "Стиль",
    desc: "Убирает воду, повторы и канцелярит. Текст яснее и короче.",
    text: "Улучши стиль: убери воду и повторы. Верни только исправленный текст.",
  },
  {
    id: "formal",
    title: "Деловой",
    desc: "Вежливый официальный тон — письма, заявления, переписка.",
    text: "Перепиши в вежливом деловом стиле. Верни только исправленный текст.",
  },
];

const textEl = document.getElementById("text");
const modesEl = document.getElementById("modes");
const statusEl = document.getElementById("status");
const loaderEl = document.getElementById("loader");
const tg = window.Telegram?.WebApp;

let busy = false;

tg?.ready();
tg?.expand();

modesEl.innerHTML = MODES.map(
  (m) => `
    <button type="button" class="mode-btn" data-id="${m.id}">
      <span class="mode-btn__title">${m.title}</span>
      <span class="mode-btn__desc">${m.desc}</span>
    </button>`
).join("");

modesEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-id]");
  if (btn) fix(MODES.find((m) => m.id === btn.dataset.id));
});

document.getElementById("copy").onclick = async () => {
  const t = textEl.value.trim();
  if (!t) return setStatus("Нечего копировать");
  try {
    await navigator.clipboard.writeText(t);
    setStatus("Скопировано");
  } catch {
    setStatus("Не удалось скопировать");
  }
};

if (location.protocol === "file:") setStatus("Запустите start-https.bat");

function setStatus(msg) {
  statusEl.textContent = msg;
}

function setBusy(on) {
  busy = on;
  loaderEl.hidden = !on;
  modesEl.querySelectorAll("button").forEach((b) => { b.disabled = on; });
  textEl.disabled = on;
}

function clean(s) {
  let t = String(s || "").trim();
  if (t.startsWith("```")) t = t.replace(/^```[\w]*\n?/, "").replace(/\n?```$/, "").trim();
  return t;
}

async function fix(mode) {
  if (busy || !mode) return;
  const userMessage = textEl.value.trim();
  if (!userMessage) return setStatus("Вставьте текст");

  setBusy(true);
  setStatus(`${mode.title}…`);

  try {
    const res = await fetch("/api/text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instructions: mode.text, userMessage }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg =
        data.error === "config_missing"
          ? "В Netlify: F5AI_API_KEY → Scopes Functions + Builds → Clear cache deploy"
          : data.message || data.error || `Ошибка ${res.status}`;
      throw new Error(msg);
    }
    textEl.value = clean(data.content);
    setStatus(`Готово: ${mode.title}`);
    tg?.HapticFeedback?.impactOccurred("light");
  } catch (err) {
    const net = err.message.includes("fetch") || location.protocol === "file:";
    setStatus(net ? "Запустите start-https.bat" : err.message);
    tg?.HapticFeedback?.notificationOccurred("error");
  } finally {
    setBusy(false);
  }
}
