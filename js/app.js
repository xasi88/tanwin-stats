/* Статистика TanWin: понятные цифры из Яндекс.Метрики.
   Ключ доступа (OAuth-токен) хранится только в этом браузере. Своего сервера нет: страница сама спрашивает API Метрики. */
"use strict";

const COUNTER = 113307386;
const CLIENT_ID = "3657b17d5af3451b88e8e4331486f614"; // приложение «Статистика TanWin» на oauth.yandex.ru, Яндекс возвращает ключ на адрес сайта
const AUTH_URL = `https://oauth.yandex.ru/authorize?response_type=token&client_id=${CLIENT_ID}`;
const API = "https://api-metrika.yandex.net";
const K_TOKEN = "tws-token", K_CACHE = "tws-cache3", K_PERIOD = "tws-period";
const SAME = 5; // изменение меньше 5% считаем обычным колебанием: значок серый

/* Цели TanWin (идентификаторы из js/usage.js приложения) человеческими словами. bad: рост здесь плохой знак. */
const GOALS = {
  onboard_started: { name: "Начали знакомство", hint: "Нажали «Начать» на первом экране." },
  onboarded: { name: "Прошли знакомство", hint: "Дошли до конца первых экранов. Процент считается от новых: кто вернулся, знакомство не проходит." },
  onboard_skipped: { name: "Пропустили знакомство", hint: "Нажали «Пропустить» на первых экранах.", bad: true },
  lesson_started: { name: "Открыли урок", hint: "Начали обычный урок." },
  lesson_done: { name: "Прошли урок", hint: "Довели урок до конца." },
  test_started: { name: "Начали проверку", hint: "Открыли проверку в конце этапа." },
  test_passed: { name: "Сдали проверку", hint: "Прошли проверку в конце этапа." },
  test_failed: { name: "Не сдали проверку", hint: "Проверка этапа не получилась с первого раза.", bad: true },
  surah_done: { name: "Прошли суру", hint: "Закончили урок суры." },
  practice_done: { name: "Закончили тренировку", hint: "Прошли тренировку в разделе «Практика»." },
  speech_used: { name: "Записали свой голос", hint: "Включили микрофон, чтобы проверить своё чтение." },
  bookmark_added: { name: "Поставили закладку", hint: "Отметили место в Коране." },
  page_to_app: { name: "Перешли со статьи в приложение", hint: "Пришли из поиска на страницу буквы и открыли приложение." },
  app_installed: { name: "Установили приложение", hint: "Поставили значок TanWin на телефон или компьютер." },
  backup_saved: { name: "Сохранили копию прогресса", hint: "Сохранили свой прогресс в файл (в «Ещё»)." },
  feedback: { name: "Написали автору", hint: "Нажали «Отправить» в окне «Написать автору» (WhatsApp)." },
  tour_done: { name: "Досмотрели подсказку новичку", hint: "Прошли подсказку на «Пути» до конца." },
  tour_skipped: { name: "Закрыли подсказку новичку", hint: "Закрыли подсказку на «Пути» раньше конца.", bad: true },
  all_messengers: { name: "Перешли в мессенджер", hint: "Нажали любую ссылку на WhatsApp или Telegram. Эту цель Метрика ведёт сама." },
};
/* Путь ученика: от первого входа до установки. */
const PATH = ["onboarded", "lesson_started", "lesson_done", "test_passed", "app_installed"];

/* Нижние вкладки TanWin: названия экранов совпадают с маршрутами в js/app.js приложения. */
const TABS = [
  ["Путь", "Главный экран: уроки по порядку."],
  ["Практика", "Тренировки и повторение."],
  ["Мой Коран", "Чтение Корана, закладки, цель чтения."],
  ["Прогресс", "Активность, этапы, суры, награды."],
  ["Ещё", "Настройки, справка, слово автора."],
];
/* Пункты «Ещё», которые открывают свой экран. «Написать автору» открывает окно: его видно в целях. */
const MORE = [
  ["Послание от разработчика", "Слово автора: как и зачем появился TanWin."],
  ["Благодарности", "Люди, чьи пожертвования помогли проекту."],
  ["Закладки", "Закладки и цель чтения."],
  ["Алфавит", "Все 28 букв: звуки, формы, махраджи."],
  ["Правила таджвида", "Цвета мусхафа и примеры из Корана."],
  ["Версии", "Что нового в TanWin."],
  ["Методика", "Как устроено обучение."],
];
/* Тренировки «Практики»: в адресе экрана английское слово. */
const PRACTICE = { review: "Повторение", hard: "Трудные слова", letters: "Буквы", ear: "Тренажёр слуха", makharij: "Махраджи", fluency: "Беглое чтение", listen: "Слова на слух", tajweed: "Найди правило" };

const PERIODS = [
  { id: "today", name: "Сегодня", days: 1 },
  { id: "week", name: "7 дней", days: 7 },
  { id: "month", name: "30 дней", days: 30 },
  { id: "all", name: "Всё время", days: 0 },
];

const $ = (s, el = document) => el.querySelector(s);
const app = $("#app");
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* браузер без памяти: работаем без неё */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* то же */ } },
};

/* ---------- Числа и слова ---------- */
const nf = new Intl.NumberFormat("ru-RU");
const num = (n) => nf.format(Math.round(n || 0));
const pct = (v, base) => base ? `${Math.round(v / base * 100)}%` : "";
function plural(n, one, few, many) {
  const a = Math.abs(Math.round(n)) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b === 1) return one;
  if (b >= 2 && b <= 4) return few;
  return many;
}
const people = (n) => `${num(n)} ${plural(n, "человек", "человека", "человек")}`;
const times = (n) => `${num(n)} ${plural(n, "раз", "раза", "раз")}`;
function dur(sec) {
  sec = Math.round(sec || 0);
  if (sec < 60) return `${sec} с`;
  const d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  if (d || h >= 10) return `${num(d * 24 + h)} ч`;
  if (h) return `${h} ч${m ? ` ${m} мин` : ""}`;
  return s && m < 10 ? `${m} мин ${s} с` : `${m} мин`;
}
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
/* Большая цифра: слова («мин», «ч») мельче самих чисел. */
const big = (v) => esc(v).replace(/\p{L}+/gu, (w) => `<small>${w}</small>`);
/* Время по часам счётчика (Москва), вида «2026-10-22 21:56:00»: так его понимает фильтр Метрики. */
let TZ;
const clock = (d) => d.toLocaleString("sv-SE", TZ ? { timeZone: TZ } : {});
const ymd = (d) => clock(d).slice(0, 10);
function shiftDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
const dayName = (s) => new Date(s + "T12:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
/* Название экрана без приписки « · TanWin» и без длинных тире. */
const cleanTitle = (s) => String(s || "").replace(/\s*[^\p{L}\p{N}\s]\s*TanWin\s*$/u, "").replace(/\p{Pd}/gu, "-");
function screenName(t) {
  const m = t.match(/^Практика: (\w+)$/);
  return m ? `Тренировка «${PRACTICE[m[1]] || m[1]}»` : t;
}

/* ---------- API Метрики ---------- */
class AuthError extends Error {}
/* Метрика отвечает не больше чем на 3 запроса одного человека сразу. Остальные ждут в очереди. */
let active = 0;
const waiting = [];
async function slot(fn) {
  if (active >= 3) await new Promise((r) => waiting.push(r));
  active++;
  try { return await fn(); } finally { active--; waiting.shift()?.(); }
}
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(path, params = {}) {
  const token = store.get(K_TOKEN);
  if (!token) throw new AuthError("нет ключа");
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  for (let attempt = 0; ; attempt++) {
    let r;
    try { r = await slot(() => fetch(url, { headers: { Authorization: "OAuth " + token } })); }
    catch { throw new Error("Нет связи с Метрикой. Проверь интернет."); }
    if (r.status === 401 || r.status === 403) throw new AuthError("ключ не подходит");
    const body = await r.json().catch(() => ({}));
    if (r.status === 429 && attempt < 3) { await pause(1200 * (attempt + 1)); continue; }
    if (!r.ok) throw new Error(body.message || `Метрика ответила ошибкой ${r.status}`);
    return body;
  }
}
const stat = (params) => api("/stat/v1/data", { ids: COUNTER, lang: "ru", accuracy: "full", ...params });
const bytime = (params) => api("/stat/v1/data/bytime", { ids: COUNTER, lang: "ru", accuracy: "full", metrics: "ym:s:users,ym:s:visits,ym:s:newUsers", ...params });
const totals = (res) => res?.totals || [];
/* Метрика отдаёт не больше 20 цифр за один запрос: цели спрашиваем пачками по 20. */
async function goalTotals(goals, params) {
  const parts = [];
  for (let i = 0; i < goals.length; i += 20) parts.push(goals.slice(i, i + 20));
  const res = await Promise.all(parts.map((p) => stat({ metrics: p.map((g) => `ym:s:goal${g.id}users`).join(","), ...params })));
  return res.flatMap(totals);
}

/* Границы периода и такого же отрезка перед ним. Прошлый отрезок кончается в тот же час и минуту, что и сейчас:
   неполный сегодняшний день сравнивается с такой же частью дня, а не с полным днём. */
function range(period, created) {
  const now = new Date();
  if (period.id === "all") return { date1: created || "2026-01-01", date2: ymd(now) };
  const back = shiftDays(now, -period.days);
  return {
    date1: ymd(shiftDays(now, 1 - period.days)), date2: ymd(now),
    prev1: ymd(shiftDays(now, 1 - 2 * period.days)), prev2: ymd(back),
    cut: clock(back), cutTime: clock(now).slice(11, 16),
  };
}

const MAIN = "ym:s:users,ym:s:visits,ym:s:newUsers,ym:s:avgVisitDurationSeconds,ym:s:pageviews,ym:s:bounceRate";
const SCREENS = { dimensions: "ym:pv:title", metrics: "ym:pv:pageviews,ym:pv:users", sort: "-ym:pv:pageviews", limit: 300 };
const FROM_MORE = "ym:pv:referer=@'#/more'"; // экраны, на которые перешли из «Ещё»

async function load(period) {
  const counter = await api(`/management/v1/counter/${COUNTER}`).catch(() => null);
  TZ = counter?.counter?.time_zone_name || TZ;
  const created = counter?.counter?.create_time?.slice(0, 10);
  const r = range(period, created);
  if (created && r.prev1 && r.prev1 < created) { delete r.prev1; delete r.prev2; delete r.cut; }
  const goalsRes = await api(`/management/v1/counter/${COUNTER}/goals`).catch(() => ({ goals: [] }));
  const goals = (goalsRes.goals || []).map((g) => ({ id: g.id, name: g.name, key: g.conditions?.[0]?.url || `goal${g.id}` }));

  const by = (new Date(r.date2) - new Date(r.date1)) / 864e5 > 90 ? "week" : "day"; // недели, только когда дней много
  let chartFrom = period.id === "today" ? ymd(shiftDays(new Date(), -13)) : r.date1;
  if (created && chartFrom < created) chartFrom = created;

  const cur = { date1: r.date1, date2: r.date2 };
  const old = r.prev1 ? { date1: r.prev1, date2: r.prev2 } : null;
  const cutS = old && { ...old, filters: `ym:s:dateTime<'${r.cut}'` };
  const cutPv = (extra) => old && { ...old, filters: `ym:pv:dateTime<'${r.cut}'${extra ? ` AND ${extra}` : ""}` };

  const jobs = {
    now: stat({ metrics: MAIN, ...cur }),
    prev: old && stat({ metrics: MAIN, ...cutS }),
    days: bytime({ group: by, date1: chartFrom, date2: r.date2 }),
    prevDays: old && period.id !== "today" ? bytime({ group: "day", ...cutS }) : null,
    goalStats: goalTotals(goals, cur),
    goalPrev: old && goalTotals(goals, cutS),
    sources: stat({ dimensions: "ym:s:lastTrafficSource", metrics: "ym:s:users", sort: "-ym:s:users", limit: 7, ...cur }),
    devices: stat({ dimensions: "ym:s:deviceCategory", metrics: "ym:s:users", sort: "-ym:s:users", limit: 5, ...cur }),
    screens: stat({ ...SCREENS, ...cur }),
    screensPrev: old && stat({ ...SCREENS, ...cutPv() }),
    more: stat({ ...SCREENS, ...cur, filters: FROM_MORE }),
    morePrev: old && stat({ ...SCREENS, ...cutPv(FROM_MORE) }),
    /* Каждый человек (браузер) отдельно: заходы и время. Отсюда рекорды и «сколько раз заходили». */
    people: stat({ dimensions: "ym:s:clientID", metrics: "ym:s:visits,ym:s:sumVisitDuration", sort: "-ym:s:visits", limit: 10000, ...cur }),
  };
  const keys = Object.keys(jobs);
  const settled = await Promise.allSettled(keys.map((k) => jobs[k]));
  const out = { period: period.id, range: r, by, goals, created, at: Date.now(), errors: {} };
  settled.forEach((s, i) => {
    if (s.status === "fulfilled") out[keys[i]] = s.value;
    else { if (s.reason instanceof AuthError) throw s.reason; out.errors[keys[i]] = String(s.reason?.message || s.reason); }
  });
  /* Экраны храним коротко: название, открытия, люди. */
  for (const k of ["screens", "screensPrev", "more", "morePrev"]) {
    if (out[k]) out[k] = (out[k].data || []).map((x) => ({ name: cleanTitle(x.dimensions[0].name), pv: x.metrics[0], users: x.metrics[1] })).filter((x) => x.name);
  }
  if (out.people) { out.peopleSum = summarizePeople(out.people.data || []); delete out.people; }
  return out;
}

/* Сводка по людям: рекорды и сколько раз заходили. Номера браузеров не сохраняются. */
function summarizePeople(rows) {
  const s = { count: rows.length, maxVisits: 0, maxTime: 0, buckets: [0, 0, 0, 0] };
  for (const r of rows) {
    const [visits, time] = r.metrics;
    s.maxVisits = Math.max(s.maxVisits, visits);
    s.maxTime = Math.max(s.maxTime, time);
    s.buckets[visits <= 1 ? 0 : visits <= 3 ? 1 : visits <= 7 ? 2 : 3]++;
  }
  return s;
}

/* ---------- Экран входа ---------- */
function showConnect(problem) {
  $("#topActions").hidden = true;
  $("#updated").textContent = "";
  app.innerHTML = `
    <section class="card connect">
      <h2>Подключить Метрику</h2>
      <p class="lead">Это нужно один раз. Потом страница сама показывает свежие цифры при каждом открытии.</p>
      ${problem ? `<p class="error">${esc(problem)}</p>` : ""}
      <ol class="steps">
        <li><p>Нажми «Войти через Яндекс». Откроется страница Яндекса.</p></li>
        <li><p>Нажми там «Разрешить». Яндекс сам вернёт тебя сюда, и цифры появятся.</p></li>
      </ol>
      <div class="btn-row">
        <a class="btn" href="${AUTH_URL}" id="login">Войти через Яндекс</a>
      </div>
      <p class="note">Страница получает право только читать статистику. Менять что-то в Метрике она не может. Ключ хранится только в этом браузере.</p>
      <details class="help">
        <summary>Если Яндекс показал ключ и не вернул сюда</summary>
        <p class="note">Скопируй ключ и нажми «Вставить ключ». Или вставь его в поле ниже.</p>
        <div class="btn-row"><button class="btn ghost" type="button" id="paste">Вставить ключ</button></div>
        <textarea id="tokenBox" placeholder="Ключ из Яндекса" autocomplete="off" spellcheck="false" aria-label="Ключ из Яндекса"></textarea>
      </details>
    </section>`;
  motion("connect");
  const box = $("#tokenBox");
  const accept = async (raw) => {
    const token = extractToken(raw);
    if (!token) { showConnect("Это не похоже на ключ. Скопируй его со страницы Яндекса ещё раз."); return; }
    store.set(K_TOKEN, token);
    start();
  };
  $("#paste").onclick = async () => {
    try { accept(await navigator.clipboard.readText()); }
    catch { box.focus(); box.placeholder = "Удерживай палец здесь и нажми «Вставить»"; }
  };
  box.addEventListener("input", () => { if (box.value.trim().length > 20) accept(box.value); });
}
function extractToken(raw) {
  const s = String(raw || "").trim();
  const m = s.match(/access_token=([^&\s]+)/);
  const t = m ? decodeURIComponent(m[1]) : s;
  return /^[A-Za-z0-9_\-.]{20,}$/.test(t) ? t : "";
}
/* Яндекс вернул ключ прямо в адрес страницы (#access_token=...). */
function takeTokenFromUrl() {
  if (!location.hash.includes("access_token=")) return;
  const t = extractToken(location.hash);
  if (t) store.set(K_TOKEN, t);
  history.replaceState(null, "", location.pathname + location.search);
}

/* ---------- Отрисовка ---------- */
function periodById(id) { return PERIODS.find((p) => p.id === id) || PERIODS[1]; }

function drawPeriods(current) {
  const box = $("#periods");
  box.innerHTML = PERIODS.map((p) => `<button type="button" role="tab" data-p="${p.id}" aria-selected="${p.id === current}">${p.name}</button>`).join("");
  box.onclick = (e) => {
    const b = e.target.closest("button[data-p]");
    if (!b || b.dataset.p === current) return;
    store.set(K_PERIOD, b.dataset.p);
    start();
  };
}

/* Изменение к прошлому отрезку. tone: цвет (up зелёный, down красный, same серый), arrow: куда сдвинулось число.
   Если оба числа меньше 10, проценты обманчивы (1 и 3 дают +200%), поэтому видна разница: «+2». */
function change(now, prev, bad = false) {
  if (prev == null || !isFinite(prev)) return null;
  now = now || 0;
  if (!now && !prev) return null;
  const diff = now - prev, small = Math.max(now, prev) < 10;
  const p = prev ? Math.round(diff / prev * 100) : null;
  const dir = !diff ? "same" : small || p === null || Math.abs(p) >= SAME ? (diff > 0 ? "up" : "down") : "same";
  const text = small ? (diff ? `${diff > 0 ? "+" : ""}${num(diff)}` : "так же") : p === null ? "новое" : `${p > 0 ? "+" : ""}${p}%`;
  const arrow = !diff ? "=" : dir === "same" ? "≈" : diff > 0 ? "▲" : "▼";
  return { dir, tone: dir === "same" ? "same" : (dir === "up") !== bad ? "up" : "down", text, arrow };
}
const badge = (c) => c ? `<span class="delta ${c.tone}">${c.arrow} ${c.text}</span>` : "";
const cmpWord = (d) => ({ today: `вчера к ${d.range.cutTime}`, week: "прошлые 7 дней", month: "прошлые 30 дней" })[d.period];
const prevTotals = (d) => d.prev && totals(d.prev)[0] > 0 ? totals(d.prev) : null;

/* Главный итог: лучше, хуже или так же. Решают три цифры: люди, пройденные уроки, общее время. */
function verdict(d) {
  const [users, visits, newUsers, avgDur] = totals(d.now);
  const prev = prevTotals(d);
  const g = goalUsers(d);
  const pname = { today: "сегодня", week: "за 7 дней", month: "за 30 дней", all: "за всё время" }[d.period];
  const Pname = pname[0].toUpperCase() + pname.slice(1);
  if (!users) return { tone: "same", sign: "🌙", title: `${Pname} пока никто не заходил`, text: "Цифры появятся, как только кто-то откроет TanWin.", chips: [] };
  const text = `${Pname} TanWin открыли ${people(users)}, всего ${times(visits)}.`;
  const chips = [
    { label: "Люди", value: num(users), c: prev && change(users, prev[0]) },
    { label: "Новые", value: num(newUsers), c: prev && change(newUsers, prev[2]) },
  ];
  if (g.lesson_done) chips.push({ label: "Прошли урок", value: num(g.lesson_done.users), c: change(g.lesson_done.users, g.lesson_done.prev) });
  chips.push({ label: "Всего времени", value: dur(avgDur * visits), c: prev && change(avgDur * visits, prev[3] * prev[1]) });
  if (!prev) {
    const why = d.period === "all" ? "Для сравнения выбери «Сегодня», «7 дней» или «30 дней»."
      : `Сравнивать пока не с чем: ${d.created ? `счётчик работает с ${dayName(d.created)}, а ` : ""}для сравнения нужен отрезок такой же длины перед этим.`;
    return { tone: "same", sign: "📊", title: d.period === "all" ? "Всё время" : "Пока без сравнения", text: `${text} ${why}`, chips };
  }
  const key = [chips[0], chips[2], chips[chips.length - 1]].filter((x, i, a) => a.indexOf(x) === i && x.c);
  const ups = key.filter((x) => x.c.tone === "up").length, downs = key.filter((x) => x.c.tone === "down").length;
  const was = d.period === "today" ? `Вчера к ${d.range.cutTime} было ${people(prev[0])}.` : `За ${cmpWord(d)} было ${people(prev[0])}.`;
  if (ups > downs) return { tone: "up", sign: "▲", title: `Лучше, чем ${cmpWord(d)}`, text: `${text} ${was}`, chips };
  if (downs > ups) return { tone: "down", sign: "▼", title: `Хуже, чем ${cmpWord(d)}`, text: `${text} ${was} Стоит посмотреть, что изменилось.`, chips };
  return { tone: "same", sign: "≈", title: ups ? `Где-то лучше, где-то хуже, чем ${cmpWord(d)}` : `Так же, как ${cmpWord(d)}`, text: `${text} ${was}`, chips };
}

function verdictCard(d) {
  const v = verdict(d);
  return `<section class="card verdict ${v.tone}">
    <div class="v-head"><span class="sign" aria-hidden="true">${v.sign}</span><div><h2>${esc(v.title)}</h2><p>${esc(v.text)}</p></div></div>
    ${v.chips.length ? `<div class="chips">${v.chips.map((x) => `<div class="chip ${x.c?.tone || ""}"><span class="chip-l">${x.label}</span><b data-num>${big(x.value)}</b>${badge(x.c)}</div>`).join("")}</div>` : ""}
  </section>`;
}

function tile({ label, value, unit = "", sub = "", c = null, was = "", what, why }) {
  return `<article class="card tile ${c?.tone || ""}">
    <span class="label">${label}</span>
    <span class="value" data-num>${big(value)}${unit ? `<small>${unit}</small>` : ""}</span>
    ${c ? `<span class="cmp">${badge(c)}<span class="was">${was}</span></span>` : ""}
    ${sub ? `<span class="sub">${sub}</span>` : ""}
    <p class="what">${what}${why ? ` <b>Зачем:</b> ${why}` : ""}</p>
  </article>`;
}

function render(d) {
  const [users, visits, newUsers, avgDur, pageviews, bounce] = totals(d.now);
  const prev = prevTotals(d) || [];
  const totalTime = (avgDur || 0) * (visits || 0), prevTime = (prev[3] || 0) * (prev[1] || 0);
  const back = Math.max(0, (users || 0) - (newUsers || 0));
  const has = prev.length > 0;

  const html = [verdictCard(d), tapeLine(d), tag("Цифры", "pink")];
  html.push(`<section class="tiles">
    ${tile({ label: "Люди", value: num(users), c: has && change(users, prev[0]), was: `было ${num(prev[0])}`, sub: `новых ${num(newUsers)}, вернулись ${num(back)}`,
      what: "Сколько разных людей открыли TanWin. Каждый считается один раз, даже если заходил много раз.", why: "главная цифра роста." })}
    ${tile({ label: "Заходы", value: num(visits), c: has && change(visits, prev[1]), was: `было ${num(prev[1])}`, sub: users ? `в среднем ${(visits / users).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} на человека` : "",
      what: "Сколько раз TanWin открывали. Заход заканчивается, когда человек 30 минут ничего не делает.", why: "видно, возвращаются ли люди учиться." })}
    ${tile({ label: "Время за один заход", value: dur(avgDur), c: has && change(avgDur, prev[3]), was: `было ${dur(prev[3])}`, sub: `экранов за заход: ${visits ? (pageviews / visits).toLocaleString("ru-RU", { maximumFractionDigits: 1 }) : 0}`,
      what: "Сколько в среднем длится один заход.", why: "чем дольше, тем больше человек занимается." })}
    ${tile({ label: "Всего времени", value: dur(totalTime), c: has && change(totalTime, prevTime), was: `было ${dur(prevTime)}`, sub: `ушли сразу: ${Math.round(bounce || 0)}% заходов`,
      what: "Сколько времени все люди вместе провели в TanWin.", why: "это общий труд учеников за период." })}
  </section>`);

  html.push(tag("По дням", "sky"), chartCard(d));
  html.push(tag("Ученики"), `<div class="cols">${pathCard(d, users, newUsers)}${recordsCard(d, users)}</div>`);
  html.push(tag("Разделы", "pink"), `<div class="cols">${sectionsCard(d, users)}${moreCard(d)}</div>`);
  html.push(tag("Что делают", "sky"), `<div class="cols">${screensCard(d)}${otherGoalsCard(d, users)}</div>`);
  html.push(tag("Откуда"), `<div class="cols">${listCard("Откуда приходят", "Последний источник перед заходом. Зачем: видно, какая реклама и какие ссылки работают.", d.sources)}
    ${listCard("С чего заходят", "Телефон, планшет или компьютер. Зачем: под что в первую очередь делать TanWin удобным.", d.devices)}</div>`);
  html.push(helpCard());
  app.innerHTML = html.join("");
  motion(d.period);
  wireChart(d);
}

/* Надпись-граффити над разделом. */
const tag = (text, color = "") => `<p class="tag-word ${color}" aria-hidden="true">${esc(text)}</p>`;

/* Бегущая лента: главные цифры периода. Текст повторён, чтобы лента шла без шва. */
function tapeLine(d) {
  const [users, visits, newUsers, avgDur] = totals(d.now);
  const done = goalUsers(d).lesson_done?.users;
  const words = [{ today: "Сегодня", week: "7 дней", month: "30 дней", all: "Всё время" }[d.period]];
  if (users) {
    words.push(people(users), `${num(visits)} ${plural(visits, "заход", "захода", "заходов")}`, `${num(newUsers)} ${plural(newUsers, "новый", "новых", "новых")}`);
    if (done) words.push(`${num(done)} ${plural(done, "прошёл урок", "прошли урок", "прошли урок")}`);
    words.push(`${dur(avgDur * visits)} учёбы`);
  } else words.push("пока тихо", "ждём учеников");
  const run = words.map((w) => `<span>${esc(w)}</span><i>✦</i>`).join("").repeat(3);
  const drips = [[8, 30], [23, 52], [41, 22], [58, 44], [77, 28], [92, 40]].map(([x, h]) => `<i style="--x:${x}%;--h:${h}px"></i>`).join("");
  return `<div class="tape" aria-hidden="true"><div class="tape-band"><div class="tape-track" id="tape">${run}${run}</div></div><div class="drips">${drips}</div></div>`;
}

const ghostWord = (d) => ({ week: "неделей раньше", month: "30 днями раньше" })[d.period];

function chartCard(d) {
  if (!d.days) return errCard("Люди по дням", d.errors.days);
  const unit = d.by === "week" ? "по неделям" : "по дням";
  const ghost = d.prevDays ? ` Жёлтая черта: столько людей было ${ghostWord(d)}. Столбик выше черты: стало лучше.` : "";
  return `<section class="card">
    <div class="card-head"><div><h2>Люди ${unit}</h2><p class="lead">Высота столбика: сколько людей открыли TanWin ${d.by === "week" ? "за неделю" : "в этот день"}.${ghost} Нажми на столбик, чтобы увидеть числа.</p></div></div>
    <div class="chart" id="chart"></div>
    <div class="legend">${d.prevDays ? `<span class="lg"><i class="lg-bar"></i>${d.period === "week" ? "эти 7 дней" : "эти 30 дней"}</span><span class="lg"><i class="lg-ghost"></i>${ghostWord(d)}</span>` : ""}${d.by === "day" ? `<span class="lg"><i class="lg-bar part"></i>сегодня: день ещё идёт</span>` : ""}</div>
    <button class="toggle-table" type="button" id="toggleTable">Показать числа таблицей</button>
    <div class="table-wrap" id="table" hidden></div>
  </section>`;
}

function seriesOf(res) {
  const rows = res?.data?.[0]?.metrics || [];
  const dates = res?.time_intervals || [];
  return dates.map((iv, i) => ({ from: iv[0], to: iv[1], users: rows[0]?.[i] || 0, visits: rows[1]?.[i] || 0, newUsers: rows[2]?.[i] || 0 }));
}

function wireChart(d) {
  const el = $("#chart");
  if (!el) return;
  const s = seriesOf(d.days);
  const ps = d.prevDays ? seriesOf(d.prevDays) : [];
  const today = d.range.date2;
  const W = Math.max(320, el.clientWidth), H = 250, padL = 36, padB = 26, padT = 10;
  const max = Math.max(1, ...s.map((x) => x.users), ...ps.map((x) => x.users));
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const iw = W - padL, ih = H - padB - padT;
  const bw = iw / Math.max(1, s.length);
  const gap = Math.min(6, bw * 0.25);
  const y = (v) => padT + ih - v / top * ih;
  const lines = [];
  for (let v = 0; v <= top; v += step) lines.push(`<line class="gridline" x1="${padL}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${padL - 8}" y="${y(v) + 4}" text-anchor="end">${num(v)}</text>`);
  const labelEvery = Math.ceil(s.length / Math.max(2, Math.floor(iw / 64)));
  const bars = s.map((p, i) => {
    const x = padL + i * bw + gap / 2, w = Math.max(2, bw - gap), h = Math.max(p.users ? 2 : 0, ih - (y(p.users) - padT));
    const r = Math.min(4, w / 2, h);
    const yTop = padT + ih - h;
    const path = h ? `M${x},${padT + ih} V${yTop + r} Q${x},${yTop} ${x + r},${yTop} H${x + w - r} Q${x + w},${yTop} ${x + w},${yTop + r} V${padT + ih} Z` : "";
    const part = d.by === "day" && p.from === today ? " part" : "";
    const order = `style="--i:${(i * 30 / s.length).toFixed(1)}"`; // столбики растут по очереди, весь график за одно время
    const gl = (cls) => `<line class="${cls}" ${order} x1="${x + 1}" x2="${x + w - 1}" y1="${y(ps[i].users)}" y2="${y(ps[i].users)}"/>`;
    const ghost = ps[i] ? gl("ghost-o") + gl("ghost") : "";
    const label = i % labelEvery === 0 || i === s.length - 1 ? `<text class="axis" x="${x + w / 2}" y="${H - 6}" text-anchor="middle">${dayName(p.from)}</text>` : "";
    return `<rect class="hit" data-i="${i}" x="${padL + i * bw}" y="${padT}" width="${bw}" height="${ih}"/><path class="bar${part}" ${order} d="${path}"/>${ghost}${label}`;
  }).join("");
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Люди ${d.by === "week" ? "по неделям" : "по дням"}">${lines.join("")}${bars}</svg>`;

  const tip = $("#tip");
  const show = (e) => {
    const t = e.target.closest(".hit");
    el.querySelectorAll(".bar.on").forEach((b) => b.classList.remove("on"));
    if (!t) { tip.hidden = true; return; }
    const i = +t.dataset.i, p = s[i];
    t.nextElementSibling?.classList.add("on");
    const when = d.by === "week" ? `${dayName(p.from)} - ${dayName(p.to)}` : new Date(p.from + "T12:00:00").toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });
    const was = ps[i] ? `<br>${ghostWord(d)[0].toUpperCase() + ghostWord(d).slice(1)}: ${num(ps[i].users)}` : "";
    tip.innerHTML = `<b>${esc(when)}${p.from === today && d.by === "day" ? " (день ещё идёт)" : ""}</b>Людей: ${num(p.users)}<br>Новых: ${num(p.newUsers)}<br>Заходов: ${num(p.visits)}${was}`;
    tip.hidden = false;
    const x = (e.clientX ?? 0), yy = (e.clientY ?? 0);
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    tip.style.left = Math.min(window.innerWidth - tw - 8, Math.max(8, x - tw / 2)) + "px";
    tip.style.top = Math.max(8, yy - th - 16) + "px";
  };
  el.onpointermove = show;
  el.onpointerdown = show;
  el.onpointerleave = (e) => { if (e.pointerType === "mouse") { tip.hidden = true; el.querySelectorAll(".bar.on").forEach((b) => b.classList.remove("on")); } };

  $("#toggleTable").onclick = () => {
    const t = $("#table");
    t.hidden = !t.hidden;
    $("#toggleTable").textContent = t.hidden ? "Показать числа таблицей" : "Скрыть таблицу";
    if (!t.hidden) t.innerHTML = `<table><thead><tr><th>${d.by === "week" ? "Неделя" : "День"}</th><th>Люди</th>${ps.length ? `<th>${esc(ghostWord(d))}</th>` : ""}<th>Новые</th><th>Заходы</th></tr></thead><tbody>${s.map((p, i) => `<tr><td>${esc(d.by === "week" ? `${dayName(p.from)} - ${dayName(p.to)}` : dayName(p.from))}</td><td>${num(p.users)}</td>${ps.length ? `<td>${ps[i] ? num(ps[i].users) : ""}</td>` : ""}<td>${num(p.newUsers)}</td><td>${num(p.visits)}</td></tr>`).reverse().join("")}</tbody></table>`;
  };
}
function niceStep(max) {
  const raw = max / 4, p = 10 ** Math.floor(Math.log10(raw)), n = raw / p;
  return Math.max(1, (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p);
}

/* Цели по ключу: люди сейчас и в прошлом отрезке. */
function goalUsers(d) {
  const map = {};
  (d.goals || []).forEach((g, i) => { map[g.key] = { users: d.goalStats?.[i] || 0, prev: d.goalPrev ? d.goalPrev[i] || 0 : null, name: g.name }; });
  return map;
}
const byTitle = (rows) => Object.fromEntries((rows || []).map((x) => [x.name, x]));

function barRow({ name, value, base, hint = "", note = "", c = null }) {
  const w = base ? Math.min(100, value / base * 100) : 0;
  return `<div class="brow">
    <div class="brow-top"><span class="name">${esc(name)}</span><span class="num"><span data-num>${num(value)}</span>${note ? `<small>${note}</small>` : ""}${badge(c)}</span></div>
    <div class="track"><div class="fill" style="width:${w.toFixed(1)}%"></div></div>
    ${hint ? `<p class="hint">${esc(hint)}</p>` : ""}
  </div>`;
}

function pathCard(d, users, newUsers) {
  if (!d.goals?.length || !d.goalStats) return errCard("Путь ученика", d.errors.goalStats || "В Метрике пока нет целей TanWin.");
  const g = goalUsers(d), prev = prevTotals(d);
  const rows = [
    barRow({ name: "Открыли TanWin", value: users, base: users, note: "100%", c: prev && change(users, prev[0]), hint: "Все люди за период." }),
    barRow({ name: "Из них новые", value: newUsers, base: users, note: pct(newUsers, users), c: prev && change(newUsers, prev[2]), hint: "Открыли TanWin впервые." }),
  ];
  for (const key of PATH) {
    if (!g[key]) continue;
    const v = g[key].users;
    const note = key === "onboarded" ? `${pct(v, newUsers)} новых` : pct(v, users);
    rows.push(barRow({ name: GOALS[key]?.name || g[key].name, value: v, base: users, hint: GOALS[key]?.hint, note, c: change(v, g[key].prev, GOALS[key]?.bad) }));
  }
  return `<section class="card"><div class="card-head"><div><h2>Путь ученика</h2>
    <p class="lead">Сколько людей дошли до каждого шага. Проценты от всех, кто открыл TanWin; у знакомства от новых. Зачем: видно, на каком шаге люди бросают.</p></div></div>
    <div class="bars">${rows.join("")}</div></section>`;
}

function recordsCard(d, users) {
  const items = [];
  const p = d.peopleSum;
  const [, visits, newUsers, avgDur] = totals(d.now);
  if (p?.maxVisits) items.push({ value: num(p.maxVisits), label: "Больше всех заходов у одного человека", what: `Самый частый ученик открыл TanWin ${times(p.maxVisits)} за период.` });
  if (p?.maxTime) items.push({ value: dur(p.maxTime), label: "Больше всех времени у одного человека", what: "Столько провёл в TanWin самый усердный ученик за период." });
  if (users) items.push({ value: dur((avgDur || 0) * (visits || 0) / users), label: "Время на одного человека", what: "Сколько в среднем провёл в TanWin один человек за период." });
  if (users) items.push({ value: pct(Math.max(0, users - newUsers), users), label: "Бывали раньше", what: "Доля людей, которые уже открывали TanWin до этого периода." });
  if (!items.length) return errCard("Рекорды", d.errors.people || "Нет данных.");
  const dist = p?.count ? `<h3 class="sub-h">Сколько раз заходили за период</h3><div class="bars">${[["1 раз", "Открыли и больше не вернулись."], ["2-3 раза", ""], ["4-7 раз", ""], ["8 раз и больше", "Постоянные ученики."]]
    .map(([name, hint], i) => barRow({ name, value: p.buckets[i], base: Math.max(...p.buckets), hint, note: pct(p.buckets[i], p.count) })).join("")}</div>` : "";
  return `<section class="card"><div class="card-head"><div><h2>Рекорды и верность</h2>
    <p class="lead">Самые активные ученики и те, кто возвращается. Зачем: видно, есть ли у TanWin постоянные ученики.</p></div></div>
    <div class="records">${items.map((x) => `<div class="record"><span class="mark" aria-hidden="true"></span><span class="value" data-num>${big(x.value)}</span><span class="label">${esc(x.label)}</span><span class="what">${esc(x.what)}</span></div>`).join("")}</div>${dist}</section>`;
}

function listCard(title, lead, res) {
  if (!res) return errCard(title, "Нет данных.");
  const rows = res.data || [];
  const total = rows.reduce((a, r) => a + r.metrics[0], 0);
  if (!rows.length) return `<section class="card"><h2>${esc(title)}</h2><p class="lead">За этот период данных нет.</p></section>`;
  return `<section class="card"><div class="card-head"><div><h2>${esc(title)}</h2><p class="lead">${esc(lead)}</p></div></div>
    <div class="bars">${rows.map((r) => barRow({ name: r.dimensions[0].name || "Не определено", value: r.metrics[0], base: rows[0].metrics[0], note: pct(r.metrics[0], total) })).join("")}</div></section>`;
}

/* Нижние вкладки TanWin: сколько людей открыли каждую. */
function sectionsCard(d, users) {
  if (!d.screens) return errCard("Разделы TanWin", d.errors.screens);
  const now = byTitle(d.screens), old = d.screensPrev && byTitle(d.screensPrev);
  const rows = TABS.map(([name, hint]) => {
    const x = now[name] || { users: 0, pv: 0 };
    return barRow({ name, value: x.users, base: users, note: pct(x.users, users), c: old && change(x.users, old[name]?.users || 0), hint: `${hint} Открывали ${times(x.pv)}.` });
  });
  return `<section class="card"><div class="card-head"><div><h2>Разделы TanWin</h2>
    <p class="lead">Сколько людей открыли каждую вкладку внизу экрана. Процент от всех, кто открыл TanWin. Зачем: видно, чем пользуются, а что не замечают.</p></div></div>
    <div class="bars">${rows.join("")}</div></section>`;
}

/* Что открывают в «Ещё»: только переходы прямо из «Ещё» (по прошлому экрану). */
function moreCard(d) {
  if (!d.more) return errCard("Что открывают в «Ещё»", d.errors.more);
  const base = byTitle(d.screens)["Ещё"]?.users || 0, oldBase = d.screensPrev ? byTitle(d.screensPrev)["Ещё"]?.users || 0 : null;
  const now = byTitle(d.more), old = d.morePrev && byTitle(d.morePrev);
  const rows = MORE.map(([name, hint]) => ({ name, hint, x: now[name] || { users: 0, pv: 0 } })).sort((a, b) => b.x.users - a.x.users)
    .map(({ name, hint, x }) => barRow({ name, value: x.users, base, note: pct(x.users, base), c: old && change(x.users, old[name]?.users || 0), hint: `${hint} Открывали ${times(x.pv)}.` }));
  return `<section class="card"><div class="card-head"><div><h2>Что открывают в «Ещё»</h2>
    <p class="lead">Сколько людей перешли из «Ещё» в каждый пункт. Процент от тех, кто открыл «Ещё». Зачем: видно, что читают, а что пропускают.</p></div></div>
    <div class="bars">${barRow({ name: "Открыли «Ещё»", value: base, base, note: "100%", c: oldBase != null && change(base, oldBase) })}${rows.join("")}</div>
    <p class="note card-foot">«Написать автору» открывает окно, а не экран. Сколько людей написали, видно в карточке «Что ещё делают».</p></section>`;
}

/* Самые частые экраны, кроме вкладок: уроки, тренировки, чтение. */
function screensCard(d) {
  if (!d.screens) return errCard("Самые частые экраны", d.errors.screens);
  const tabs = new Set(TABS.map(([n]) => n));
  const rows = d.screens.filter((x) => !tabs.has(x.name)).slice(0, 8);
  if (!rows.length) return `<section class="card"><h2>Самые частые экраны</h2><p class="lead">За этот период данных нет.</p></section>`;
  return `<section class="card"><div class="card-head"><div><h2>Самые частые экраны</h2>
    <p class="lead">Уроки, тренировки и другие экраны, кроме вкладок. Число: сколько раз экран открыли. Зачем: видно, что людям интереснее всего.</p></div></div>
    <div class="bars">${rows.map((x) => barRow({ name: screenName(x.name), value: x.pv, base: rows[0].pv, note: people(x.users) })).join("")}</div></section>`;
}

function otherGoalsCard(d, users) {
  if (!d.goals?.length || !d.goalStats) return "";
  const g = goalUsers(d);
  const rows = Object.entries(g).filter(([k, x]) => !PATH.includes(k) && (GOALS[k] || x.users > 0)).sort((a, b) => b[1].users - a[1].users);
  if (!rows.length) return "";
  const max = Math.max(1, ...rows.map(([, x]) => x.users));
  return `<section class="card"><div class="card-head"><div><h2>Что ещё делают</h2>
    <p class="lead">Сколько людей хотя бы раз сделали это за период. Процент от всех, кто открыл TanWin.</p></div></div>
    <div class="bars">${rows.map(([k, x]) => barRow({ name: GOALS[k]?.name || x.name, value: x.users, base: max, hint: GOALS[k]?.hint, note: pct(x.users, users), c: change(x.users, x.prev, GOALS[k]?.bad) })).join("")}</div></section>`;
}

function errCard(title, msg) {
  return `<section class="card"><h2>${esc(title)}</h2><p class="lead">${esc(msg || "Метрика не отдала эти данные.")}</p></section>`;
}

function helpCard() {
  return `<section class="card"><details class="help"><summary>Как считаются цифры</summary><ul>
    <li><b>Человек</b> для Метрики: один браузер на одном устройстве. Если человек открыл TanWin на телефоне и на компьютере, он считается дважды.</li>
    <li><b>Заход</b> (визит): человек открыл TanWin и что-то делал. Если 30 минут ничего не делать, следующий шаг будет уже новым заходом.</li>
    <li><b>Время</b> считается от первого до последнего действия в заходе. Если человек открыл экран и сразу ушёл, время почти нулевое.</li>
    <li><b>Ушли сразу</b> (отказ): заход короче 15 секунд и всего с одним экраном.</li>
    <li><b>Сравнение</b> (▲ и ▼) идёт с таким же отрезком прямо перед выбранным и до того же часа и минуты. «Сегодня» в 14:00 сравнивается со вчерашним днём до 14:00, а не с полным днём.</li>
    <li><b>Цвет значка:</b> зелёный: стало лучше, красный: хуже, серый: изменение меньше 5%, это обычное колебание. Если оба числа меньше 10, вместо процентов видна разница: «+2».</li>
    <li><b>Итог наверху</b> решают три цифры: люди, пройденные уроки и общее время. Больше зелёных: «Лучше». Больше красных: «Хуже».</li>
    <li><b>«Ещё»</b>: считаются только переходы прямо из «Ещё». Тот же экран, открытый с «Пути» или из уведомления, сюда не попадает.</li>
    <li>Ученики, которые выключили «Анонимную статистику» в TanWin, в цифры не попадают.</li>
    <li>Данные приходят из Яндекс.Метрики с опозданием в несколько минут.</li>
  </ul></details>
  <div class="foot"><span>Счётчик ${COUNTER}</span>${installEvt ? `<button class="btn ghost" type="button" id="install">Поставить значок на устройство</button>` : ""}<button class="link-btn" type="button" id="logout">Отключить ключ на этом устройстве</button></div></section>`;
}

/* ---------- Движение, как на сайте C4 Street: вес, пружина, глубина ----------
   Карточки вылетают, буквы падают, цифры отсчитываются, полосы растут. Всё это один раз при открытии
   и при смене периода: тихое обновление данных показывает новые цифры сразу. */
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
if (!reduce) document.documentElement.classList.add("anim");
let seen = new Set(), seenFor = ""; // карточки, которые уже появились на этом экране
const io = new IntersectionObserver((entries) => entries.forEach((e) => {
  if (!e.isIntersecting) return;
  io.unobserve(e.target);
  reveal(e.target, true);
}), { rootMargin: "0px 0px -6% 0px", threshold: 0 });

function reveal(el, play) {
  el.classList.add("in");
  seen.add(el.dataset.k);
  if (play) el.querySelectorAll("[data-num]").forEach(countUp);
}

/* После каждой отрисовки: разбить заголовки на буквы, расставить очередь и показать карточки. */
function motion(screen) {
  if (screen !== seenFor) { seen = new Set(); seenFor = screen; }
  io.disconnect();
  app.querySelectorAll(".bars, .chips, .records").forEach((box) => [...box.children].forEach((x, i) => x.style.setProperty("--i", i)));
  app.querySelectorAll(".card h2, .tag-word").forEach(splitLetters);
  app.querySelectorAll(".card:not(.skeleton), .tag-word, .tape").forEach((el, i) => {
    el.dataset.k = i;
    if (reduce || seen.has(String(i))) reveal(el, false);
    else io.observe(el);
  });
  tapeHalf = 0;
}

/* Каждая буква отдельно, слова не рвутся. Экранный диктор читает заголовок целиком. */
function splitLetters(el) {
  if (el.dataset.split) return;
  el.dataset.split = "1";
  el.classList.add("kin");
  if (!el.hasAttribute("aria-hidden")) el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim());
  let i = 0;
  const walk = (node) => [...node.childNodes].forEach((n) => {
    if (n.nodeType === 1) { walk(n); return; }
    if (n.nodeType !== 3) return;
    const frag = document.createDocumentFragment();
    n.textContent.split(/(\s+)/).forEach((part) => {
      if (!part) return;
      if (/^\s+$/.test(part)) { frag.append(" "); return; }
      const w = document.createElement("span");
      w.className = "w";
      w.setAttribute("aria-hidden", "true");
      for (const c of part) {
        const s = document.createElement("span");
        s.className = "ch";
        s.style.setProperty("--i", i++);
        s.textContent = c;
        w.append(s);
      }
      frag.append(w);
    });
    n.replaceWith(frag);
  });
  walk(el);
}

/* Цифры отсчитываются от нуля. Меняются только числа, слова и проценты остаются на месте. */
const NUM = /\d+(?:[  ]\d{3})*/g;
function countUp(el) {
  if (reduce) return;
  const parts = [];
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  while (tw.nextNode()) if (/\d/.test(tw.currentNode.data)) parts.push([tw.currentNode, tw.currentNode.data]);
  if (!parts.length) return;
  const t0 = performance.now() + 200, D = 1100;
  const step = (now) => {
    const k = Math.min(Math.max((now - t0) / D, 0), 1), e = 1 - (1 - k) ** 4;
    parts.forEach(([n, text]) => { n.data = text.replace(NUM, (m) => num(+m.replace(/\D/g, "") * e)); });
    if (k < 1) requestAnimationFrame(step);
  };
  step(performance.now());
  requestAnimationFrame(step);
}

/* Шапка с тенью при прокрутке, фон на разной глубине, лента ускоряется, когда листают. */
const header = $("#top");
const layers = [...document.querySelectorAll(".bg [data-speed]")].map((el) => [el, +el.dataset.speed]);
let tapeX = 0, tapeHalf = 0, vel = 0, dir = -1, lastY = scrollY, prevT = performance.now();
addEventListener("scroll", () => header.classList.toggle("scrolled", scrollY > 8), { passive: true });
function tick(now) {
  const dt = Math.min(now - prevT, 50); prevT = now;
  const y = scrollY, dy = y - lastY; lastY = y;
  if (dy) dir = dy > 0 ? -1 : 1;
  vel += (Math.abs(dy) - vel) * .12;
  layers.forEach(([el, s]) => { el.style.translate = `0 ${(-y * s).toFixed(1)}px`; });
  const track = $("#tape");
  if (track) {
    if (!tapeHalf) tapeHalf = track.scrollWidth / 2;
    tapeX += dir * (.05 + vel * .02) * dt;
    if (tapeX <= -tapeHalf) tapeX += tapeHalf;
    if (tapeX > 0) tapeX -= tapeHalf;
    track.style.transform = `translateX(${tapeX.toFixed(1)}px)`;
  }
  requestAnimationFrame(tick);
}
if (!reduce) requestAnimationFrame(tick);
document.fonts?.ready.then(() => { tapeHalf = 0; });
requestAnimationFrame(() => { splitLetters($("#title")); requestAnimationFrame(() => $("#title").classList.add("in")); });

/* ---------- Запуск ---------- */
let busy = false;
async function start() {
  takeTokenFromUrl();
  if (!store.get(K_TOKEN)) { showConnect(); return; }
  const period = periodById(store.get(K_PERIOD) || "week");
  $("#topActions").hidden = false;
  drawPeriods(period.id);

  let cached = null;
  try { cached = JSON.parse(store.get(K_CACHE) || "null"); } catch { cached = null; }
  if (cached && cached.period === period.id) { render(cached); stamp(cached.at, true); }
  else app.innerHTML = `<section class="card skeleton"></section><section class="tiles">${'<div class="card skeleton"></div>'.repeat(4)}</section><section class="card skeleton" style="min-height:300px"></section>`;

  if (busy) return;
  busy = true;
  $("#refresh").classList.add("spin");
  let stale = false; // пока шла загрузка, выбрали другой период: загрузить и его
  try {
    const d = await load(period);
    stale = periodById(store.get(K_PERIOD) || "week").id !== period.id;
    if (!stale) {
      store.set(K_CACHE, JSON.stringify(d));
      render(d);
      stamp(d.at, false);
    }
  } catch (e) {
    if (e instanceof AuthError) { store.del(K_TOKEN); showConnect("Яндекс не принял ключ. Подключи Метрику заново."); return; }
    if (!cached) { app.innerHTML = `<section class="card"><p class="error">${esc(e.message)}</p></section>`; motion("error"); }
    else $("#updated").textContent += ` · ${e.message}`;
  } finally {
    busy = false;
    $("#refresh").classList.remove("spin");
  }
  if (stale) start();
}
function stamp(at, old) {
  const t = new Date(at);
  const today = ymd(t) === ymd(new Date());
  const s = today ? t.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : t.toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  $("#updated").textContent = old ? `Данные от ${s}. Обновляю…` : `Обновлено в ${s}`;
}

/* Установка значком: Chrome сам предлагает её, кнопка появляется внизу страницы. */
let installEvt = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; });
window.addEventListener("appinstalled", () => { installEvt = null; $("#install")?.remove(); });

document.addEventListener("click", (e) => {
  if (e.target.id === "install" && installEvt) { installEvt.prompt(); installEvt.userChoice.finally(() => { installEvt = null; e.target.remove(); }); }
  if (e.target.id === "refresh" || e.target.closest("#refresh")) start();
  if (e.target.id === "logout") { store.del(K_TOKEN); store.del(K_CACHE); showConnect(); }
});
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && store.get(K_TOKEN)) start(); });
let resizeT;
window.addEventListener("resize", () => { clearTimeout(resizeT); resizeT = setTimeout(() => { tapeHalf = 0; try { const c = JSON.parse(store.get(K_CACHE) || "null"); if (c && $("#chart")) wireChart(c); } catch { /* нет данных */ } }, 150); });

store.del("tws-cache2"); // память прошлой версии страницы
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
start();
