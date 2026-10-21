/* Статистика TanWin: понятные цифры из Яндекс.Метрики.
   Ключ доступа (OAuth-токен) хранится только в этом браузере. Своего сервера нет: страница сама спрашивает API Метрики. */
"use strict";

const COUNTER = 113307386;
const CLIENT_ID = "3657b17d5af3451b88e8e4331486f614"; // приложение «Статистика TanWin» на oauth.yandex.ru, Яндекс возвращает ключ на адрес сайта
const AUTH_URL = `https://oauth.yandex.ru/authorize?response_type=token&client_id=${CLIENT_ID}`;
const API = "https://api-metrika.yandex.net";
const K_TOKEN = "tws-token", K_CACHE = "tws-cache", K_PERIOD = "tws-period";

/* Цели TanWin (идентификаторы из js/metrika.js приложения) человеческими словами. */
const GOALS = {
  onboard_started: { name: "Начали знакомство", hint: "Нажали «Начать» на первом экране." },
  onboarded: { name: "Прошли знакомство", hint: "Дошли до конца первых экранов и выбрали, с чего начать." },
  onboard_skipped: { name: "Пропустили знакомство", hint: "Нажали «Пропустить» на первых экранах." },
  lesson_started: { name: "Открыли урок", hint: "Начали обычный урок." },
  lesson_done: { name: "Прошли урок", hint: "Довели урок до конца." },
  test_passed: { name: "Сдали проверку", hint: "Прошли проверку в конце этапа." },
  test_failed: { name: "Не сдали проверку", hint: "Проверка этапа не получилась с первого раза." },
  surah_done: { name: "Прошли суру", hint: "Закончили урок суры." },
  practice_done: { name: "Закончили тренировку", hint: "Прошли тренировку в разделе «Практика»." },
  speech_used: { name: "Записали свой голос", hint: "Включили микрофон, чтобы проверить своё чтение." },
  bookmark_added: { name: "Поставили закладку", hint: "Отметили место в Коране." },
  page_to_app: { name: "Перешли со статьи в приложение", hint: "Пришли из поиска на страницу буквы и открыли приложение." },
  app_installed: { name: "Установили приложение", hint: "Поставили значок TanWin на телефон или компьютер." },
  backup_saved: { name: "Сохранили копию прогресса", hint: "Сохранили свой прогресс в файл." },
  feedback: { name: "Написали автору", hint: "Нажали «Написать автору» в WhatsApp." },
};
/* Путь ученика: от первого входа до установки. */
const PATH = ["onboarded", "lesson_started", "lesson_done", "test_passed", "app_installed"];

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
function plural(n, one, few, many) {
  const a = Math.abs(Math.round(n)) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b === 1) return one;
  if (b >= 2 && b <= 4) return few;
  return many;
}
function dur(sec) {
  sec = Math.round(sec || 0);
  if (sec < 60) return `${sec} с`;
  const d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  if (d || h) return `${num(d * 24 + h)} ч${m ? ` ${m} мин` : ""}`;
  return s && m < 10 ? `${m} мин ${s} с` : `${m} мин`;
}
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function ymd(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function shiftDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
const dayName = (s) => new Date(s + "T12:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "short" });

/* ---------- API Метрики ---------- */
class AuthError extends Error {}
async function api(path, params = {}) {
  const token = store.get(K_TOKEN);
  if (!token) throw new AuthError("нет ключа");
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  let r;
  try { r = await fetch(url, { headers: { Authorization: "OAuth " + token } }); }
  catch { throw new Error("Нет связи с Метрикой. Проверь интернет."); }
  if (r.status === 401 || r.status === 403) throw new AuthError("ключ не подходит");
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.message || `Метрика ответила ошибкой ${r.status}`);
  return body;
}
const stat = (params) => api("/stat/v1/data", { ids: COUNTER, lang: "ru", accuracy: "full", ...params });
const totals = (res) => res.totals || [];

/* Границы периода и такого же периода перед ним (для сравнения). */
function range(period, created) {
  const today = new Date();
  if (period.id === "all") return { date1: created || "2026-01-01", date2: ymd(today) };
  const d1 = shiftDays(today, -(period.days - 1));
  const r = { date1: ymd(d1), date2: ymd(today) };
  if (period.id !== "today") { r.prev1 = ymd(shiftDays(d1, -period.days)); r.prev2 = ymd(shiftDays(d1, -1)); }
  else { r.prev1 = r.prev2 = ymd(shiftDays(today, -1)); }
  return r;
}

const MAIN = "ym:s:users,ym:s:visits,ym:s:newUsers,ym:s:avgVisitDurationSeconds,ym:s:pageviews,ym:s:bounceRate";

async function load(period) {
  const counter = await api(`/management/v1/counter/${COUNTER}`).catch(() => null);
  const created = counter?.counter?.create_time?.slice(0, 10);
  const r = range(period, created);
  const goalsRes = await api(`/management/v1/counter/${COUNTER}/goals`).catch(() => ({ goals: [] }));
  const goals = (goalsRes.goals || []).map((g) => ({ id: g.id, name: g.name, key: g.conditions?.[0]?.url || "" }));

  const goalMetrics = goals.slice(0, 20).map((g) => `ym:s:goal${g.id}users`);
  const by = period.id === "all" ? "week" : "day";
  const chartFrom = period.id === "today" ? ymd(shiftDays(new Date(), -13)) : r.date1;

  const jobs = {
    now: stat({ metrics: MAIN, date1: r.date1, date2: r.date2 }),
    prev: r.prev1 ? stat({ metrics: MAIN, date1: r.prev1, date2: r.prev2 }) : null,
    days: api("/stat/v1/data/bytime", { ids: COUNTER, lang: "ru", accuracy: "full", metrics: "ym:s:users,ym:s:visits,ym:s:newUsers", group: by, date1: chartFrom, date2: r.date2 }),
    goalStats: goalMetrics.length ? stat({ metrics: goalMetrics.join(","), date1: r.date1, date2: r.date2 }) : null,
    sources: stat({ dimensions: "ym:s:lastTrafficSource", metrics: "ym:s:users", sort: "-ym:s:users", limit: 7, date1: r.date1, date2: r.date2 }),
    devices: stat({ dimensions: "ym:s:deviceCategory", metrics: "ym:s:users", sort: "-ym:s:users", limit: 5, date1: r.date1, date2: r.date2 }),
    screens: stat({ dimensions: "ym:pv:title", metrics: "ym:pv:pageviews,ym:pv:users", sort: "-ym:pv:pageviews", limit: 8, date1: r.date1, date2: r.date2 }),
    people: stat({ dimensions: "ym:s:clientID", metrics: "ym:s:visits,ym:s:sumVisitDuration", sort: "-ym:s:visits", limit: 1, date1: r.date1, date2: r.date2 }),
    longest: stat({ dimensions: "ym:s:clientID", metrics: "ym:s:sumVisitDuration,ym:s:visits", sort: "-ym:s:sumVisitDuration", limit: 1, date1: r.date1, date2: r.date2 }),
    visitsDist: stat({ dimensions: "ym:s:userVisitsInterval", metrics: "ym:s:users", sort: "ym:s:userVisitsInterval", limit: 20, date1: r.date1, date2: r.date2 }),
  };
  const keys = Object.keys(jobs);
  const settled = await Promise.allSettled(keys.map((k) => jobs[k]));
  const out = { period: period.id, range: r, by, goals, at: Date.now(), errors: {} };
  settled.forEach((s, i) => {
    if (s.status === "fulfilled") out[keys[i]] = s.value;
    else { if (s.reason instanceof AuthError) throw s.reason; out.errors[keys[i]] = String(s.reason?.message || s.reason); }
  });
  return out;
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

function delta(now, prev, periodId) {
  if (prev == null || !isFinite(prev)) return "";
  const word = periodId === "today" ? "чем вчера" : "чем за прошлые " + (periodId === "week" ? "7 дней" : "30 дней");
  if (!prev && !now) return "";
  if (!prev) return `<span class="delta up">▲ новое</span>`;
  const p = Math.round((now - prev) / prev * 100);
  if (p === 0) return `<span class="delta same">= как ${periodId === "today" ? "вчера" : "раньше"}</span>`;
  return `<span class="delta ${p > 0 ? "up" : "down"}">${p > 0 ? "▲" : "▼"} ${p > 0 ? "+" : ""}${p}% ${word}</span>`;
}

function verdict(d) {
  const [users, visits] = totals(d.now);
  const prev = d.prev ? totals(d.prev)[0] : null;
  const pname = { today: "сегодня", week: "за 7 дней", month: "за 30 дней", all: "за всё время" }[d.period];
  if (!users) return { icon: "🌙", title: `${pname[0].toUpperCase() + pname.slice(1)} пока никто не заходил`, text: "Цифры появятся, как только кто-то откроет TanWin." };
  let text = `${pname[0].toUpperCase() + pname.slice(1)} TanWin открыли ${num(users)} ${plural(users, "человек", "человека", "человек")}, всего ${num(visits)} ${plural(visits, "раз", "раза", "раз")}.`;
  let icon = "📊";
  if (prev != null && d.period !== "today" && prev > 0) {
    const p = Math.round((users - prev) / prev * 100);
    if (p >= 10) { icon = "📈"; text += ` Людей стало больше на ${p}%. Хороший рост.`; }
    else if (p <= -10) { icon = "📉"; text += ` Людей стало меньше на ${-p}%. Стоит посмотреть, что изменилось.`; }
    else { icon = "➖"; text += " Примерно столько же, сколько раньше."; }
  }
  return { icon, title: "Как дела", text };
}

function tile({ label, value, unit = "", sub = "", deltaHtml = "", what, why }) {
  return `<article class="card tile">
    <span class="label">${label}</span>
    <span class="value">${value}${unit ? `<small>${unit}</small>` : ""}</span>
    ${deltaHtml}
    ${sub ? `<span class="sub">${sub}</span>` : ""}
    <p class="what">${what}${why ? ` <b>Зачем:</b> ${why}` : ""}</p>
  </article>`;
}

function render(d) {
  const [users, visits, newUsers, avgDur, pageviews, bounce] = totals(d.now);
  const prev = d.prev ? totals(d.prev) : [];
  const v = verdict(d);
  const totalTime = (avgDur || 0) * (visits || 0);
  const back = Math.max(0, (users || 0) - (newUsers || 0));

  const html = [];
  html.push(`<section class="card verdict"><span class="big-emoji" aria-hidden="true">${v.icon}</span><div><h2>${esc(v.title)}</h2><p>${esc(v.text)}</p></div></section>`);

  html.push(`<section class="tiles">
    ${tile({ label: "Люди", value: num(users), deltaHtml: delta(users, prev[0], d.period), sub: `новых ${num(newUsers)}, вернулись ${num(back)}`,
      what: "Сколько разных людей открыли TanWin. Каждый считается один раз, даже если заходил много раз.", why: "главная цифра роста." })}
    ${tile({ label: "Заходы", value: num(visits), deltaHtml: delta(visits, prev[1], d.period), sub: users ? `в среднем ${(visits / users).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} на человека` : "",
      what: "Сколько раз TanWin открывали. Заход заканчивается, когда человек 30 минут ничего не делает.", why: "видно, возвращаются ли люди учиться." })}
    ${tile({ label: "Время за один заход", value: dur(avgDur), deltaHtml: delta(avgDur, prev[3], d.period), sub: `экранов за заход: ${visits ? (pageviews / visits).toLocaleString("ru-RU", { maximumFractionDigits: 1 }) : 0}`,
      what: "Сколько в среднем длится один заход.", why: "чем дольше, тем больше человек занимается." })}
    ${tile({ label: "Всего времени", value: dur(totalTime), deltaHtml: delta(totalTime, (prev[3] || 0) * (prev[1] || 0), d.period), sub: `ушли сразу: ${Math.round(bounce || 0)}% заходов`,
      what: "Сколько времени все люди вместе провели в TanWin.", why: "это общий труд учеников за период." })}
  </section>`);

  html.push(chartCard(d));
  html.push(`<div class="cols">${pathCard(d, users)}${recordsCard(d, users)}</div>`);
  html.push(`<div class="cols">${listCard("Откуда приходят", "Последний источник перед заходом. Зачем: видно, какая реклама и какие ссылки работают.", d.sources, "ym:s:users")}
    ${listCard("С чего заходят", "Телефон, планшет или компьютер. Зачем: под что в первую очередь делать TanWin удобным.", d.devices, "ym:s:users")}</div>`);
  html.push(`<div class="cols">${screensCard(d)}${otherGoalsCard(d, users)}</div>`);
  html.push(helpCard());
  app.innerHTML = html.join("");
  wireChart(d);
}

function chartCard(d) {
  if (!d.days) return errCard("Люди по дням", d.errors.days);
  const unit = d.by === "week" ? "по неделям" : "по дням";
  return `<section class="card">
    <div class="card-head"><div><h2>Люди ${unit}</h2><p class="lead">Высота столбика: сколько людей открыли TanWin ${d.by === "week" ? "за неделю" : "в этот день"}. Нажми на столбик, чтобы увидеть числа.</p></div></div>
    <div class="chart" id="chart"></div>
    <button class="toggle-table" type="button" id="toggleTable">Показать числа таблицей</button>
    <div class="table-wrap" id="table" hidden></div>
  </section>`;
}

function seriesOf(d) {
  const rows = d.days?.data?.[0]?.metrics || [];
  const dates = d.days?.time_intervals || [];
  return dates.map((iv, i) => ({ from: iv[0], to: iv[1], users: rows[0]?.[i] || 0, visits: rows[1]?.[i] || 0, newUsers: rows[2]?.[i] || 0 }));
}

function wireChart(d) {
  const el = $("#chart");
  if (!el) return;
  const s = seriesOf(d);
  const W = Math.max(320, el.clientWidth), H = 240, padL = 36, padB = 26, padT = 8;
  const max = Math.max(1, ...s.map((x) => x.users));
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
    const label = i % labelEvery === 0 || i === s.length - 1 ? `<text class="axis" x="${x + w / 2}" y="${H - 6}" text-anchor="middle">${dayName(p.from)}</text>` : "";
    return `<rect class="hit" data-i="${i}" x="${padL + i * bw}" y="${padT}" width="${bw}" height="${ih}"/><path class="bar" d="${path}"/>${label}`;
  }).join("");
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Люди ${d.by === "week" ? "по неделям" : "по дням"}">${lines.join("")}${bars}</svg>`;

  const tip = $("#tip");
  const show = (e) => {
    const t = e.target.closest(".hit");
    el.querySelectorAll(".bar.on").forEach((b) => b.classList.remove("on"));
    if (!t) { tip.hidden = true; return; }
    const p = s[+t.dataset.i];
    t.nextElementSibling?.classList.add("on");
    const when = d.by === "week" ? `${dayName(p.from)} - ${dayName(p.to)}` : new Date(p.from + "T12:00:00").toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });
    tip.innerHTML = `<b>${esc(when)}</b>Людей: ${num(p.users)}<br>Новых: ${num(p.newUsers)}<br>Заходов: ${num(p.visits)}`;
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
    if (!t.hidden) t.innerHTML = `<table><thead><tr><th>${d.by === "week" ? "Неделя" : "День"}</th><th>Люди</th><th>Новые</th><th>Заходы</th></tr></thead><tbody>${s.slice().reverse().map((p) => `<tr><td>${esc(d.by === "week" ? `${dayName(p.from)} - ${dayName(p.to)}` : dayName(p.from))}</td><td>${num(p.users)}</td><td>${num(p.newUsers)}</td><td>${num(p.visits)}</td></tr>`).join("")}</tbody></table>`;
  };
}
function niceStep(max) {
  const raw = max / 4, p = 10 ** Math.floor(Math.log10(raw)), n = raw / p;
  return Math.max(1, (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p);
}

function goalUsers(d) {
  const vals = totals(d.goalStats);
  const map = {};
  d.goals.slice(0, 20).forEach((g, i) => { map[g.key] = { users: vals[i] || 0, name: g.name }; });
  return map;
}

function barRow(name, value, base, hint, note = "") {
  const pct = base ? Math.min(100, value / base * 100) : 0;
  return `<div class="brow">
    <div class="brow-top"><span class="name">${esc(name)}</span><span class="num">${num(value)}${note ? `<small>${note}</small>` : ""}</span></div>
    <div class="track"><div class="fill" style="width:${pct.toFixed(1)}%"></div></div>
    ${hint ? `<p class="hint">${esc(hint)}</p>` : ""}
  </div>`;
}

function pathCard(d, users) {
  if (!d.goals?.length || !d.goalStats) return errCard("Путь ученика", d.errors.goalStats || "В Метрике пока нет целей TanWin.");
  const g = goalUsers(d);
  const rows = [barRow("Открыли TanWin", users, users, "Все люди за период.", "100%")];
  for (const key of PATH) {
    if (!g[key]) continue;
    const v = g[key].users;
    rows.push(barRow(GOALS[key]?.name || g[key].name, v, users, GOALS[key]?.hint, users ? `${Math.round(v / users * 100)}%` : ""));
  }
  return `<section class="card"><div class="card-head"><div><h2>Путь ученика</h2>
    <p class="lead">Сколько людей дошли до каждого шага. Проценты считаются от всех, кто открыл TanWin. Зачем: видно, на каком шаге люди бросают.</p></div></div>
    <div class="bars">${rows.join("")}</div></section>`;
}

function recordsCard(d, users) {
  const items = [];
  const top = d.people?.data?.[0];
  if (top) items.push({ value: num(top.metrics[0]), label: "Больше всех заходов у одного человека", what: `Этот человек открывал TanWin ${num(top.metrics[0])} ${plural(top.metrics[0], "раз", "раза", "раз")} за период.` });
  const longest = d.longest?.data?.[0];
  if (longest) items.push({ value: dur(longest.metrics[0]), label: "Больше всех времени у одного человека", what: "Столько провёл в TanWin самый усердный ученик за период." });
  const dist = d.visitsDist?.data;
  if (dist?.length) {
    const many = dist.filter((r) => /^(\d+)/.test(r.dimensions[0].name) && parseInt(r.dimensions[0].name, 10) >= 3).reduce((a, r) => a + r.metrics[0], 0);
    if (many) items.push({ value: num(many), label: "Заходили 3 раза и больше", what: "Это те, кто возвращается. Самые ценные ученики." });
  }
  const [, visits, newUsers] = totals(d.now);
  if (users) items.push({ value: `${Math.round(Math.max(0, users - newUsers) / users * 100)}%`, label: "Вернулись снова", what: "Доля людей, которые уже бывали в TanWin раньше." });
  if (!items.length) return errCard("Рекорды", d.errors.people || "Нет данных.");
  return `<section class="card"><div class="card-head"><div><h2>Рекорды и верность</h2>
    <p class="lead">Самые активные ученики и те, кто возвращается. Зачем: видно, есть ли у TanWin постоянные ученики.</p></div></div>
    <div class="records">${items.map((x) => `<div class="record"><span class="mark" aria-hidden="true"></span><span class="value">${x.value}</span><span class="label">${esc(x.label)}</span><span class="what">${esc(x.what)}</span></div>`).join("")}</div></section>`;
}

function listCard(title, lead, res, metric) {
  if (!res) return errCard(title, "Нет данных.");
  const rows = res.data || [];
  const total = rows.reduce((a, r) => a + r.metrics[0], 0);
  if (!rows.length) return `<section class="card"><h2>${esc(title)}</h2><p class="lead">За этот период данных нет.</p></section>`;
  return `<section class="card"><div class="card-head"><div><h2>${esc(title)}</h2><p class="lead">${esc(lead)}</p></div></div>
    <div class="bars">${rows.map((r) => barRow(r.dimensions[0].name || "Не определено", r.metrics[0], rows[0].metrics[0], "", total ? `${Math.round(r.metrics[0] / total * 100)}%` : "")).join("")}</div></section>`;
}

function screensCard(d) {
  if (!d.screens) return errCard("Что открывают", d.errors.screens);
  const rows = (d.screens.data || []).filter((r) => r.dimensions[0].name);
  if (!rows.length) return `<section class="card"><h2>Что открывают</h2><p class="lead">За этот период данных нет.</p></section>`;
  return `<section class="card"><div class="card-head"><div><h2>Что открывают</h2>
    <p class="lead">Самые частые экраны TanWin. Число: сколько раз экран открыли. Зачем: видно, что людям интереснее всего.</p></div></div>
    <div class="bars">${rows.map((r) => barRow(r.dimensions[0].name.replace(/\s*·\s*TanWin\s*$/, ""), r.metrics[0], rows[0].metrics[0], "", `${num(r.metrics[1])} ${plural(r.metrics[1], "человек", "человека", "человек")}`)).join("")}</div></section>`;
}

function otherGoalsCard(d, users) {
  if (!d.goals?.length || !d.goalStats) return "";
  const g = goalUsers(d);
  const rows = Object.entries(g).filter(([k]) => !PATH.includes(k)).sort((a, b) => b[1].users - a[1].users);
  if (!rows.length) return "";
  const max = Math.max(1, ...rows.map(([, x]) => x.users));
  return `<section class="card"><div class="card-head"><div><h2>Что ещё делают</h2>
    <p class="lead">Сколько людей хотя бы раз сделали это за период.</p></div></div>
    <div class="bars">${rows.map(([k, x]) => barRow(GOALS[k]?.name || x.name, x.users, max, GOALS[k]?.hint, users ? `${Math.round(x.users / users * 100)}%` : "")).join("")}</div></section>`;
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
    <li>Ученики, которые выключили «Анонимную статистику» в TanWin, в цифры не попадают.</li>
    <li>Сравнение (▲ и ▼) идёт с таким же отрезком времени прямо перед выбранным. Для «Сегодня» сравнение с полным вчерашним днём, поэтому утром цифра почти всегда ниже.</li>
    <li>Данные приходят из Яндекс.Метрики с опозданием в несколько минут.</li>
  </ul></details>
  <div class="foot"><span>Счётчик ${COUNTER}</span><button class="link-btn" type="button" id="logout">Отключить ключ на этом устройстве</button></div></section>`;
}

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
  try {
    const d = await load(period);
    if (periodById(store.get(K_PERIOD) || "week").id !== period.id) return;
    store.set(K_CACHE, JSON.stringify(d));
    render(d);
    stamp(d.at, false);
  } catch (e) {
    if (e instanceof AuthError) { store.del(K_TOKEN); showConnect("Яндекс не принял ключ. Подключи Метрику заново."); return; }
    if (!cached) app.innerHTML = `<section class="card"><p class="error">${esc(e.message)}</p></section>`;
    else $("#updated").textContent += ` · ${e.message}`;
  } finally {
    busy = false;
    $("#refresh").classList.remove("spin");
  }
}
function stamp(at, old) {
  const t = new Date(at);
  const today = ymd(t) === ymd(new Date());
  const s = today ? t.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : t.toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  $("#updated").textContent = old ? `Данные от ${s}. Обновляю…` : `Обновлено в ${s}`;
}

document.addEventListener("click", (e) => {
  if (e.target.id === "refresh" || e.target.closest("#refresh")) start();
  if (e.target.id === "logout") { store.del(K_TOKEN); store.del(K_CACHE); showConnect(); }
});
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && store.get(K_TOKEN)) start(); });
let resizeT;
window.addEventListener("resize", () => { clearTimeout(resizeT); resizeT = setTimeout(() => { try { const c = JSON.parse(store.get(K_CACHE) || "null"); if (c && $("#chart")) wireChart(c); } catch { /* нет данных */ } }, 150); });

if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
start();
