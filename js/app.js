/* Статистика проектов: понятные цифры из Яндекс.Метрики. Проект: один счётчик Метрики, список счётчиков страница берёт у Метрики сама.
   Ключ доступа (OAuth-токен) хранится только в этом браузере. Своего сервера нет: страница сама спрашивает API Метрики. */
"use strict";

const TANWIN = 113307386; // счётчик TanWin: у него свои карточки (путь ученика, разделы, «Ещё»)
const KATALOG = 113761734; // счётчик каталога техники: свои карточки (путь покупателя, модели, цвета, поиск)
const CLIENT_ID = "3657b17d5af3451b88e8e4331486f614"; // приложение «Статистика TanWin» на oauth.yandex.ru, Яндекс возвращает ключ на адрес сайта
const AUTH_URL = `https://oauth.yandex.ru/authorize?response_type=token&client_id=${CLIENT_ID}`;
const API = "https://api-metrika.yandex.net";
const K_TOKEN = "tws-token", K_CACHE = "tws-cache4", K_PERIOD = "tws-period", K_COUNTER = "tws-counter", K_COUNTERS = "tws-counters";
const SAME = 5; // изменение меньше 5% считаем обычным колебанием: значок серый
/* Короткие имена проектов вместо названий счётчиков в Метрике. */
const NAMES = { [TANWIN]: "TanWin" };

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
const PNAME = { today: "сегодня", week: "за 7 дней", month: "за 30 дней", all: "за всё время" };

const $ = (s, el = document) => el.querySelector(s);
const app = $("#app");
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* браузер без памяти: работаем без неё */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* то же */ } },
};
const readJSON = (k) => { try { return JSON.parse(store.get(k) || "null"); } catch { return null; } };

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
/* Среднее бывает дробным: «3,5 человека». */
const avg = (n) => n < 10 && n % 1 ? n.toLocaleString("ru-RU", { maximumFractionDigits: 1 }) : num(n);
const peopleAvg = (n) => { const s = avg(n); return `${s} ${s.includes(",") ? "человека" : plural(+s.replace(/\D/g, ""), "человек", "человека", "человек")}`; };
const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : "";
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
/* Время по часам счётчика (у TanWin Москва), вида «2026-10-22 21:56:00»: так его понимает фильтр Метрики. */
let TZ;
const clock = (d) => d.toLocaleString("sv-SE", TZ ? { timeZone: TZ } : {});
const ymd = (d) => clock(d).slice(0, 10);
function shiftDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
const dayName = (s) => new Date(s + "T12:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
/* Дни недели с понедельника. */
const WD = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const WD_FULL = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];
const WD_IN = ["в понедельник", "во вторник", "в среду", "в четверг", "в пятницу", "в субботу", "в воскресенье"];
const weekday = (s) => (new Date(s + "T12:00:00").getDay() + 6) % 7;
/* Название экрана без приписки « · TanWin» и без длинных тире. */
const cleanTitle = (s) => String(s || "").replace(/\s*[^\p{L}\p{N}\s]\s*TanWin\s*$/u, "").replace(/\p{Pd}/gu, "-");
function screenName(t) {
  const m = t.match(/^Практика: (\w+)$/);
  return m ? `Тренировка «${PRACTICE[m[1]] || m[1]}»` : t;
}
const isTW = (d) => d.counter?.id === TANWIN;
const isKT = (d) => d.counter?.id === KATALOG;

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
/* Номер счётчика (ids) приходит в каждом запросе: так данные одного проекта не смешаются с другим. */
const stat = (params) => api("/stat/v1/data", { lang: "ru", accuracy: "full", ...params });
const bytime = (params) => api("/stat/v1/data/bytime", { lang: "ru", accuracy: "full", metrics: "ym:s:users,ym:s:visits,ym:s:newUsers", ...params });
const totals = (res) => res?.totals || [];
/* Метрика отдаёт не больше 20 цифр за один запрос: цели спрашиваем пачками по 20. */
async function goalTotals(goals, params) {
  const parts = [];
  for (let i = 0; i < goals.length; i += 20) parts.push(goals.slice(i, i + 20));
  const res = await Promise.all(parts.map((p) => stat({ metrics: p.map((g) => `ym:s:goal${g.id}users`).join(","), ...params })));
  return res.flatMap(totals);
}

/* Все счётчики аккаунта. Каждый счётчик здесь отдельный проект. */
async function counterList() {
  const res = await api("/management/v1/counters", { per_page: 100 });
  const list = (res.counters || []).filter((c) => c.status !== "Deleted")
    .map((c) => ({ id: c.id, name: NAMES[c.id] || c.name || c.site || `Счётчик ${c.id}`, site: c.site, created: c.create_time?.slice(0, 10), tz: c.time_zone_name }))
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  store.set(K_COUNTERS, JSON.stringify(list));
  return list;
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
const HOURS = { dimensions: "ym:s:hour", metrics: "ym:s:visits,ym:s:users", sort: "ym:s:hour", limit: 24 };
const FROM_MORE = "ym:pv:referer=@'#/more'"; // экраны TanWin, на которые перешли из «Ещё»

async function load(period, c) {
  TZ = c.tz || TZ;
  const created = c.created, ids = c.id, tw = ids === TANWIN, kt = ids === KATALOG;
  const r = range(period, created);
  if (created && r.prev1 && r.prev1 < created) { delete r.prev1; delete r.prev2; delete r.cut; }
  const goalsRes = await api(`/management/v1/counter/${ids}/goals`).catch(() => ({ goals: [] }));
  const goals = (goalsRes.goals || []).map((g) => ({ id: g.id, name: g.name, key: g.conditions?.[0]?.url || `goal${g.id}` }));

  const by = (new Date(r.date2) - new Date(r.date1)) / 864e5 > 90 ? "week" : "day"; // недели, только когда дней много
  let chartFrom = period.id === "today" ? ymd(shiftDays(new Date(), -13)) : r.date1;
  if (created && chartFrom < created) chartFrom = created;
  /* По дням недели нужны целые дни. «Сегодня»: 4 недели до сегодня. Долгая история, где график идёт по неделям: свой запрос по дням. */
  const yesterday = ymd(shiftDays(new Date(), -1));
  let wdFrom = ymd(shiftDays(new Date(), -28));
  if (created && wdFrom < created) wdFrom = created;

  const cur = { ids, date1: r.date1, date2: r.date2 };
  const old = r.prev1 ? { ids, date1: r.prev1, date2: r.prev2 } : null;
  const cutS = old && { ...old, filters: `ym:s:dateTime<'${r.cut}'` };
  const cutPv = (extra) => old && { ...old, filters: `ym:pv:dateTime<'${r.cut}'${extra ? ` AND ${extra}` : ""}` };

  const jobs = {
    now: stat({ metrics: MAIN, ...cur }),
    prev: old && stat({ metrics: MAIN, ...cutS }),
    days: bytime({ ids, group: by, date1: chartFrom, date2: r.date2 }),
    prevDays: old && period.id !== "today" ? bytime({ group: "day", ...cutS }) : null,
    wdays: period.id === "today" ? (wdFrom <= yesterday ? bytime({ ids, group: "day", date1: wdFrom, date2: yesterday }) : null)
      : by === "week" ? bytime({ ids, group: "day", date1: chartFrom, date2: r.date2 }) : null,
    hours: stat({ ...HOURS, ...cur }),
    hoursPrev: old && stat({ ...HOURS, ...cutS }),
    goalStats: goalTotals(goals, cur),
    goalPrev: old && goalTotals(goals, cutS),
    sources: stat({ dimensions: "ym:s:lastTrafficSource", metrics: "ym:s:users", sort: "-ym:s:users", limit: 7, ...cur }),
    devices: stat({ dimensions: "ym:s:deviceCategory", metrics: "ym:s:users", sort: "-ym:s:users", limit: 5, ...cur }),
    screens: stat({ ...SCREENS, ...cur }),
    screensPrev: tw && old ? stat({ ...SCREENS, ...cutPv() }) : null,
    more: tw ? stat({ ...SCREENS, ...cur, filters: FROM_MORE }) : null,
    morePrev: tw && old ? stat({ ...SCREENS, ...cutPv(FROM_MORE) }) : null,
    /* Каталог: параметры визитов (выбор цвета, заказ, поиск, раздел) и страницы моделей. Их пишет сам сайт каталога. */
    catParams: kt ? stat({ ...CAT_PARAMS, ...cur }) : null,
    catModels: kt ? stat({ dimensions: "ym:pv:title", metrics: "ym:pv:pageviews,ym:pv:users", filters: CAT_MODEL, sort: "-ym:pv:pageviews", limit: 300, ...cur }) : null,
    catModelUsers: kt ? stat({ metrics: "ym:pv:users", filters: CAT_MODEL, ...cur }) : null,
    /* Каждый человек (браузер) отдельно: заходы и время. Отсюда рекорды и «сколько раз заходили». */
    people: stat({ dimensions: "ym:s:clientID", metrics: "ym:s:visits,ym:s:sumVisitDuration", sort: "-ym:s:visits", limit: 10000, ...cur }),
  };
  const keys = Object.keys(jobs);
  const settled = await Promise.allSettled(keys.map((k) => jobs[k]));
  const out = { counter: { id: ids, name: c.name, site: c.site, tz: TZ }, period: period.id, range: r, by, goals, created, at: Date.now(), errors: {} };
  settled.forEach((s, i) => {
    if (s.status === "fulfilled") out[keys[i]] = s.value;
    else { if (s.reason instanceof AuthError) throw s.reason; out.errors[keys[i]] = String(s.reason?.message || s.reason); }
  });
  /* Экраны храним коротко: название, открытия, люди. */
  for (const k of ["screens", "screensPrev", "more", "morePrev"]) {
    if (out[k]) out[k] = (out[k].data || []).map((x) => ({ name: cleanTitle(x.dimensions[0].name), pv: x.metrics[0], users: x.metrics[1] })).filter((x) => x.name);
  }
  /* Часы: 24 пары «заходы, люди». Час без заходов Метрика не присылает, у него нули. */
  for (const k of ["hours", "hoursPrev"]) {
    if (!out[k]) continue;
    const a = Array.from({ length: 24 }, () => [0, 0]);
    for (const x of out[k].data || []) { const h = +x.dimensions[0].id; if (a[h]) a[h] = x.metrics; }
    out[k] = a;
  }
  if (out.people) { out.peopleSum = summarizePeople(out.people.data || []); delete out.people; }
  if (out.catParams || out.catModels) {
    out.cat = summarizeCatalog(out.catParams, out.catModels, out.catModelUsers);
    delete out.catParams; delete out.catModels; delete out.catModelUsers;
  }
  return out;
}

/* Каталог техники. Параметры визитов пишет сайт каталога (index.html и страницы моделей):
   «Выбор цвета» и «Заказ в WhatsApp»: модель с памятью -> версия (цвет, страна, SIM); «Открыли модель»: модель -> память;
   «Поиск в каталоге» и «Раздел каталога»: одно значение. Число: заходы, в которых это было. */
const CAT_PARAMS = { dimensions: "ym:s:paramsLevel1,ym:s:paramsLevel2,ym:s:paramsLevel3", metrics: "ym:s:visits,ym:s:users", sort: "-ym:s:visits", limit: 2000 };
const CAT_MODEL = "ym:pv:URLPath=@'/model/'"; // страницы моделей: адрес вида /katalog-tehniki/model/iphone-17-pro/
const CAT_GROUPS = { "Выбор цвета": "choose", "Заказ в WhatsApp": "order", "Открыли модель": "opened", "Поиск в каталоге": "search", "Раздел каталога": "section" };
/* Название страницы модели: «Купить iPhone 17 Pro в Грозном: цена от …». Цена меняется, модель нет. */
const modelOfTitle = (t) => (String(t || "").match(/^Купить\s+(.+?)\s+в\s+Грозном/) || [])[1] || cleanTitle(t);
/* «iPhone 17 Pro Max, 2 ТБ» -> «iPhone 17 Pro Max»; «Серебристый, Япония, eSIM» -> «Серебристый». */
const firstPart = (s) => String(s || "").split(", ")[0];
function summarizeCatalog(params, models, modelUsers) {
  const cat = { choose: [], order: [], opened: [], search: [], section: [], models: [], pageUsers: totals(modelUsers)[0] || 0 };
  for (const r of params?.data || []) {
    const [g, a, b] = r.dimensions.map((x) => x?.name ?? null);
    const k = CAT_GROUPS[g];
    if (k && a) cat[k].push({ a, b, visits: r.metrics[0], users: r.metrics[1] });
  }
  const m = {};
  for (const r of models?.data || []) {
    const name = modelOfTitle(r.dimensions[0].name);
    if (!name) continue;
    m[name] = m[name] || { name, pv: 0, users: 0 };
    m[name].pv += r.metrics[0]; m[name].users += r.metrics[1];
  }
  cat.models = Object.values(m);
  return cat;
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

/* Последние данные каждого проекта и периода: страница открывается сразу, потом обновляется. Хранятся 12 последних. */
const cacheAll = () => readJSON(K_CACHE) || {};
const cacheGet = (id, period) => cacheAll()[`${id}:${period}`] || null;
function cacheSet(d) {
  const all = cacheAll();
  all[`${d.counter.id}:${d.period}`] = d;
  store.set(K_CACHE, JSON.stringify(Object.fromEntries(Object.entries(all).sort((a, b) => b[1].at - a[1].at).slice(0, 12))));
}

/* ---------- Экран входа ---------- */
function showConnect(problem) {
  $("#topActions").hidden = true;
  $("#proj").hidden = true;
  menu(false);
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

/* ---------- Выбор проекта ---------- */
/* Выбранный счётчик. Если его больше нет в аккаунте, берём первый из списка. */
function savedId(list) {
  const id = +store.get(K_COUNTER) || TANWIN;
  return list.length && !list.some((c) => c.id === id) ? list[0].id : id;
}
function drawProjects(list, id) {
  const name = list.find((c) => c.id === id)?.name || NAMES[id] || "Проект";
  $("#proj").hidden = false;
  $("#projName").textContent = name;
  $(".ghost-word").textContent = name;
  $("#projMenu").innerHTML = `<p class="pm-h">Проекты в Метрике</p>
    <div class="pm-list" role="listbox" aria-label="Проекты">${list.map((c) => `<button class="pm-item" type="button" role="option" data-id="${c.id}" aria-selected="${c.id === id}"><b>${esc(c.name)}</b><small>${esc(c.site || `счётчик ${c.id}`)}</small></button>`).join("")}</div>
    ${list.length < 2 ? `<p class="pm-note">Здесь видны все счётчики Метрики в твоём аккаунте Яндекса. Поставишь счётчик на другой сайт: он сам появится в этом списке.</p>` : ""}`;
}
/* Список проектов открывается прямо под кнопкой. */
function menu(open) {
  const m = $("#projMenu"), b = $("#proj");
  if (open) m.style.top = `${b.getBoundingClientRect().bottom - header.getBoundingClientRect().top + 12}px`;
  m.hidden = !open;
  b.setAttribute("aria-expanded", String(open));
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

/* Главный итог: лучше, хуже или так же. Решают люди, пройденные уроки (у TanWin) и общее время. */
function verdict(d) {
  const [users, visits, newUsers, avgDur] = totals(d.now);
  const prev = prevTotals(d);
  const g = goalUsers(d), nm = d.counter.name;
  const Pname = cap(PNAME[d.period]);
  if (!users) return { tone: "same", sign: "🌙", title: `${Pname} пока никто не заходил`, text: `Цифры появятся, как только кто-то откроет ${nm}.`, chips: [] };
  const text = `${Pname} ${nm} открыли ${people(users)}, всего ${times(visits)}.`;
  const chips = [
    { label: "Люди", value: num(users), c: prev && change(users, prev[0]) },
    { label: "Новые", value: num(newUsers), c: prev && change(newUsers, prev[2]) },
  ];
  if (isTW(d) && g.lesson_done) chips.push({ label: "Прошли урок", value: num(g.lesson_done.users), c: change(g.lesson_done.users, g.lesson_done.prev) });
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

let shown = null; // данные, которые сейчас на экране
function render(d) {
  shown = d;
  tagN = 0;
  TZ = d.counter.tz || TZ;
  const tw = isTW(d), nm = esc(d.counter.name);
  const [users, visits, newUsers, avgDur, pageviews, bounce] = totals(d.now);
  const prev = prevTotals(d) || [];
  const totalTime = (avgDur || 0) * (visits || 0), prevTime = (prev[3] || 0) * (prev[1] || 0);
  const back = Math.max(0, (users || 0) - (newUsers || 0));
  const has = prev.length > 0;

  const html = [verdictCard(d), tapeLine(d), tag("Цифры")];
  html.push(`<section class="tiles">
    ${tile({ label: "Люди", value: num(users), c: has && change(users, prev[0]), was: `было ${num(prev[0])}`, sub: `новых ${num(newUsers)}, вернулись ${num(back)}`,
      what: `Сколько разных людей открыли ${nm}. Каждый считается один раз, даже если заходил много раз.`, why: "главная цифра роста." })}
    ${tile({ label: "Заходы", value: num(visits), c: has && change(visits, prev[1]), was: `было ${num(prev[1])}`, sub: users ? `в среднем ${(visits / users).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} на человека` : "",
      what: `Сколько раз ${nm} открывали. Заход заканчивается, когда человек 30 минут ничего не делает.`, why: tw ? "видно, возвращаются ли люди учиться." : "видно, возвращаются ли люди." })}
    ${tile({ label: "Время за один заход", value: dur(avgDur), c: has && change(avgDur, prev[3]), was: `было ${dur(prev[3])}`, sub: `экранов за заход: ${visits ? (pageviews / visits).toLocaleString("ru-RU", { maximumFractionDigits: 1 }) : 0}`,
      what: "Сколько в среднем длится один заход.", why: tw ? "чем дольше, тем больше человек занимается." : "чем дольше, тем интереснее человеку." })}
    ${tile({ label: "Всего времени", value: dur(totalTime), c: has && change(totalTime, prevTime), was: `было ${dur(prevTime)}`, sub: `ушли сразу: ${Math.round(bounce || 0)}% заходов`,
      what: `Сколько времени все люди вместе провели ${tw ? "в TanWin" : "на сайте"}.`, why: tw ? "это общий труд учеников за период." : "это общее внимание людей к проекту." })}
  </section>`);

  html.push(tag("По дням"), chartCard(d));
  html.push(tag("Когда заходят"), cols(weekdayCard(d), hoursCard(d)));
  if (tw) {
    html.push(tag("Ученики"), cols(pathCard(d, users, newUsers), recordsCard(d, users)));
    html.push(tag("Разделы"), cols(sectionsCard(d, users), moreCard(d)));
    html.push(tag("Что делают"), cols(screensCard(d), otherGoalsCard(d, users)));
  } else {
    if (isKT(d)) {
      html.push(tag("Покупатели"), cols(funnelCard(d, users), modelsCard(d)));
      html.push(tag("Цвета"), cols(colorsCard(d), versionsCard(d)));
      html.push(tag("Поиск"), cols(searchCard(d), catSectionsCard(d)));
    }
    html.push(tag("Люди"), cols(recordsCard(d, users), otherGoalsCard(d, users)));
    html.push(tag("Что смотрят"), screensCard(d));
  }
  html.push(tag("Откуда"), cols(listCard("Откуда приходят", "Последний источник перед заходом. Зачем: видно, какая реклама и какие ссылки работают.", d.sources),
    listCard("С чего заходят", `Телефон, планшет или компьютер. Зачем: под что в первую очередь делать ${d.counter.name} удобным.`, d.devices)));
  html.push(helpCard(d));
  app.innerHTML = html.join("");
  motion(`${d.counter.id}:${d.period}`);
  wireCharts(d);
}

/* Надпись-граффити над разделом. Цвета идут по кругу. */
let tagN = 0;
const tag = (text) => `<p class="tag-word ${["pink", "sky", ""][tagN++ % 3]}" aria-hidden="true">${esc(text)}</p>`;
/* Две карточки рядом. Одна карточка идёт во всю ширину. */
const cols = (...cards) => { const c = cards.filter(Boolean); return c.length > 1 ? `<div class="cols">${c.join("")}</div>` : c.join(""); };
const legend = (rows) => `<div class="legend">${rows.filter(Boolean).map(([cls, text]) => `<span class="lg"><i class="${cls}"></i>${esc(text)}</span>`).join("")}</div>`;

/* Бегущая лента: главные цифры периода. Текст повторён, чтобы лента шла без шва. */
function tapeLine(d) {
  const [users, visits, newUsers, avgDur] = totals(d.now);
  const tw = isTW(d), done = goalUsers(d).lesson_done?.users;
  const words = [{ today: "Сегодня", week: "7 дней", month: "30 дней", all: "Всё время" }[d.period]];
  if (users) {
    words.push(people(users), `${num(visits)} ${plural(visits, "заход", "захода", "заходов")}`, `${num(newUsers)} ${plural(newUsers, "новый", "новых", "новых")}`);
    if (tw && done) words.push(`${num(done)} ${plural(done, "прошёл урок", "прошли урок", "прошли урок")}`);
    words.push(tw ? `${dur(avgDur * visits)} учёбы` : `общее время ${dur(avgDur * visits)}`);
  } else words.push("пока тихо", tw ? "ждём учеников" : "ждём гостей");
  const run = words.map((w) => `<span>${esc(w)}</span><i>✦</i>`).join("").repeat(3);
  const drips = [[8, 30], [23, 52], [41, 22], [58, 44], [77, 28], [92, 40]].map(([x, h]) => `<i style="--x:${x}%;--h:${h}px"></i>`).join("");
  return `<div class="tape" aria-hidden="true"><div class="tape-band"><div class="tape-track" id="tape">${run}${run}</div></div><div class="drips">${drips}</div></div>`;
}

const ghostWord = (d) => ({ today: "вчера", week: "неделей раньше", month: "30 днями раньше" })[d.period];

function chartCard(d) {
  if (!d.days) return errCard("Люди по дням", d.errors.days);
  const unit = d.by === "week" ? "по неделям" : "по дням";
  const ghost = d.prevDays ? ` Жёлтая черта: столько людей было ${ghostWord(d)}. Столбик выше черты: стало лучше.` : "";
  return `<section class="card">
    <div class="card-head"><div><h2>Люди ${unit}</h2><p class="lead">Высота столбика: сколько людей открыли ${esc(d.counter.name)} ${d.by === "week" ? "за неделю" : "в этот день"}.${ghost} Нажми на столбик, чтобы увидеть числа.</p></div></div>
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

/* Все графики страницы. Перерисовываются и при смене размера окна. */
function wireCharts(d) {
  wireChart(d);
  const w = weekdayData(d), wEl = $("#wdChart");
  if (w && wEl) drawBars(wEl, w.items, { aria: "Люди по дням недели", H: 220, labelW: 30 });
  const h = hoursData(d), hEl = $("#hrChart");
  if (h && hEl) drawBars(hEl, h.items, { aria: "Заходы по часам", H: 220, labelW: 46 });
}

function wireChart(d) {
  const el = $("#chart");
  if (!el) return;
  const s = seriesOf(d.days);
  const ps = d.prevDays ? seriesOf(d.prevDays) : [];
  const today = d.range.date2;
  drawBars(el, s.map((p, i) => {
    const now = d.by === "day" && p.from === today;
    const when = d.by === "week" ? `${dayName(p.from)} - ${dayName(p.to)}` : new Date(p.from + "T12:00:00").toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });
    const was = ps[i] ? `<br>${cap(ghostWord(d))}: ${num(ps[i].users)}` : "";
    return { value: p.users, ghost: ps[i] ? ps[i].users : null, label: dayName(p.from), part: now,
      tip: `<b>${esc(when)}${now ? " (день ещё идёт)" : ""}</b>Людей: ${num(p.users)}<br>Новых: ${num(p.newUsers)}<br>Заходов: ${num(p.visits)}${was}` };
  }), { aria: `Люди ${d.by === "week" ? "по неделям" : "по дням"}`, last: true });

  $("#toggleTable").onclick = () => {
    const t = $("#table");
    t.hidden = !t.hidden;
    $("#toggleTable").textContent = t.hidden ? "Показать числа таблицей" : "Скрыть таблицу";
    if (!t.hidden) t.innerHTML = `<table><thead><tr><th>${d.by === "week" ? "Неделя" : "День"}</th><th>Люди</th>${ps.length ? `<th>${esc(ghostWord(d))}</th>` : ""}<th>Новые</th><th>Заходы</th></tr></thead><tbody>${s.map((p, i) => `<tr><td>${esc(d.by === "week" ? `${dayName(p.from)} - ${dayName(p.to)}` : dayName(p.from))}</td><td>${num(p.users)}</td>${ps.length ? `<td>${ps[i] ? num(ps[i].users) : ""}</td>` : ""}<td>${num(p.newUsers)}</td><td>${num(p.visits)}</td></tr>`).reverse().join("")}</tbody></table>`;
  };
}

/* Столбики с подсказкой по нажатию. items: { value, ghost (жёлтая черта прошлого периода), label, part (ещё идёт), best (самый сильный), tip }.
   labelW: сколько места нужно одной подписи снизу. Если тесно, подписи идут через одну и реже. last: всегда подписать последний столбик. */
function drawBars(el, items, { aria, H = 250, labelW = 64, last = false }) {
  const W = Math.max(280, el.clientWidth), padL = 36, padB = 26, padT = 10;
  const max = Math.max(1, ...items.map((p) => Math.max(p.value, p.ghost || 0)));
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const iw = W - padL, ih = H - padB - padT;
  const bw = iw / Math.max(1, items.length);
  const gap = Math.min(6, bw * 0.25);
  const y = (v) => padT + ih - v / top * ih;
  const lines = [];
  for (let v = 0; v <= top; v += step) lines.push(`<line class="gridline" x1="${padL}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${padL - 8}" y="${y(v) + 4}" text-anchor="end">${num(v)}</text>`);
  const every = Math.ceil(items.length / Math.max(2, Math.floor(iw / labelW)));
  const bars = items.map((p, i) => {
    const x = padL + i * bw + gap / 2, w = Math.max(2, bw - gap), h = Math.max(p.value ? 2 : 0, ih - (y(p.value) - padT));
    const r = Math.min(4, w / 2, h);
    const yTop = padT + ih - h;
    const path = h ? `M${x},${padT + ih} V${yTop + r} Q${x},${yTop} ${x + r},${yTop} H${x + w - r} Q${x + w},${yTop} ${x + w},${yTop + r} V${padT + ih} Z` : "";
    const cls = p.part ? " part" : p.best ? " best" : "";
    const order = `style="--i:${(i * 30 / items.length).toFixed(1)}"`; // столбики растут по очереди, весь график за одно время
    const gl = (c) => `<line class="${c}" ${order} x1="${x + 1}" x2="${x + w - 1}" y1="${y(p.ghost)}" y2="${y(p.ghost)}"/>`;
    const ghost = p.ghost != null ? gl("ghost-o") + gl("ghost") : "";
    const label = i % every === 0 || (last && i === items.length - 1) ? `<text class="axis" x="${x + w / 2}" y="${H - 6}" text-anchor="middle">${esc(p.label)}</text>` : "";
    return `<rect class="hit" data-i="${i}" x="${padL + i * bw}" y="${padT}" width="${bw}" height="${ih}"/><path class="bar${cls}" ${order} d="${path}"/>${ghost}${label}`;
  }).join("");
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="height:${H}px" role="img" aria-label="${esc(aria)}">${lines.join("")}${bars}</svg>`;

  /* Нажатие пальцем открывает подсказку, второе нажатие на тот же столбик закрывает её. Мышь показывает подсказку при наведении. */
  const tip = $("#tip");
  const show = (e, toggle) => {
    const t = e.target.closest(".hit");
    if (!t || (toggle && t.nextElementSibling?.classList.contains("on"))) { hideTip(); return; }
    document.querySelectorAll(".bar.on").forEach((b) => b.classList.remove("on"));
    t.nextElementSibling?.classList.add("on");
    tip.innerHTML = items[+t.dataset.i].tip;
    tip.hidden = false;
    const x = (e.clientX ?? 0), yy = (e.clientY ?? 0);
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    tip.style.left = Math.min(window.innerWidth - tw - 8, Math.max(8, x - tw / 2)) + "px";
    tip.style.top = Math.max(8, yy - th - 16) + "px";
  };
  el.onpointermove = (e) => { if (e.pointerType === "mouse") show(e); };
  el.onpointerdown = (e) => show(e, e.pointerType !== "mouse");
  el.onpointerleave = (e) => { if (e.pointerType === "mouse") hideTip(); };
}
function hideTip() {
  $("#tip").hidden = true;
  document.querySelectorAll(".bar.on").forEach((b) => b.classList.remove("on"));
}
function niceStep(max) {
  const raw = max / 4, p = 10 ** Math.floor(Math.log10(raw)), n = raw / p;
  return Math.max(1, (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p);
}

/* Среднее за один день по дням недели. skip: сегодняшний день, он ещё идёт и занизил бы среднее. */
function byWeekday(series, skip) {
  const w = WD.map(() => ({ users: 0, visits: 0, newUsers: 0, n: 0 }));
  for (const p of series) {
    if (p.from === skip) continue;
    const x = w[weekday(p.from)];
    x.users += p.users; x.visits += p.visits; x.newUsers += p.newUsers; x.n++;
  }
  return w.map((x) => x.n ? { users: x.users / x.n, visits: x.visits / x.n, newUsers: x.newUsers / x.n, n: x.n } : null);
}

/* По дням недели с понедельника. За 7 дней каждый день недели один раз: видно сами дни. За долгий период: среднее за один такой день. */
function weekdayData(d) {
  const src = d.wdays || (d.by === "day" ? d.days : null);
  if (!src) return null;
  const today = d.range.date2, one = d.period === "week", s = seriesOf(src), gw = ghostWord(d);
  const w = byWeekday(s, one ? null : today);
  const pw = d.prevDays ? byWeekday(seriesOf(d.prevDays), one ? null : d.range.prev2) : null;
  const items = WD.map((label, i) => {
    const x = w[i], g = pw?.[i];
    const day = one ? s.find((p) => weekday(p.from) === i) : null;
    const now = day?.from === today;
    const was = g ? `<br>${cap(gw)}: ${avg(g.users)}` : "";
    const tip = !x ? `<b>${WD_FULL[i]}</b>Таких дней в периоде ещё не было.`
      : one ? `<b>${WD_FULL[i]}, ${dayName(day.from)}${now ? " (день ещё идёт)" : ""}</b>Людей: ${num(x.users)}<br>Новых: ${num(x.newUsers)}<br>Заходов: ${num(x.visits)}${was}`
      : `<b>${WD_FULL[i]}</b>В среднем за день:<br>людей ${avg(x.users)}, заходов ${avg(x.visits)}<br>Дней в расчёте: ${x.n}${was}`;
    return { value: x ? x.users : 0, ghost: g ? g.users : null, label, part: now, tip, x };
  });
  const real = items.filter((p) => p.x);
  const best = real.reduce((a, p) => (!a || p.value > a.value ? p : a), null);
  const calm = real.filter((p) => !p.part).reduce((a, p) => (!a || p.value < a.value ? p : a), null);
  let sum = "";
  if (best?.value) {
    best.best = true;
    const b = items.indexOf(best), c = items.indexOf(calm);
    sum = one ? `Больше всего людей было <b>${WD_IN[b]}</b>: ${people(best.value)}.` : `Чаще всего заходят <b>${WD_IN[b]}</b>: в среднем ${peopleAvg(best.value)} за день.`;
    if (calm && calm.value < best.value) sum += ` Меньше всего ${WD_IN[c]}: ${one ? people(calm.value) : peopleAvg(calm.value)}.`;
  }
  const days = s.filter((p) => p.from !== today).length;
  const ghostNote = pw ? ` Жёлтая черта: ${gw}.` : "";
  const lead = (one ? `Сколько людей открыли ${esc(d.counter.name)} в каждый день недели за эти 7 дней.`
    : `Сколько людей в среднем за один такой день. Посчитано за ${days} ${plural(days, "день", "дня", "дней")} до сегодня, сегодня не считается: день ещё идёт.`)
    + `${ghostNote} Зачем: видно, в какие дни заходят чаще.`;
  return { items, sum, lead, legend: [
    ["lg-bar", one ? "эти 7 дней" : "в среднем за день"], pw && ["lg-ghost", gw],
    items.some((p) => p.part) && ["lg-bar part", "сегодня: день ещё идёт"], best?.value && ["lg-bar best", "самый сильный день"],
  ] };
}
function weekdayCard(d) {
  const w = weekdayData(d);
  if (!w) return errCard("По дням недели", d.errors.wdays || d.errors.days);
  return `<section class="card"><div class="card-head"><div><h2>По дням недели</h2><p class="lead">${w.lead}</p></div></div>
    ${w.sum ? `<p class="sum">${w.sum}</p>` : ""}<div class="chart" id="wdChart"></div>${legend(w.legend)}</section>`;
}

/* По часам: сколько заходов началось в каждый час, по часам счётчика. */
function hoursData(d) {
  if (!d.hours) return null;
  const today = d.period === "today", nowH = +clock(new Date()).slice(11, 13), prev = d.hoursPrev;
  const gw = today ? `вчера к ${d.range.cutTime}` : ghostWord(d);
  const items = d.hours.map(([visits, users], h) => {
    const now = today && h === nowH;
    return { value: visits, ghost: prev ? prev[h][0] : null, label: `${h}:00`, part: now,
      tip: `<b>${h}:00 - ${h + 1}:00${now ? " (час ещё идёт)" : ""}</b>Заходов: ${num(visits)}<br>Людей: ${num(users)}${prev ? `<br>${cap(gw)}: ${num(prev[h][0])}` : ""}` };
  });
  const total = items.reduce((a, p) => a + p.value, 0);
  const peak = items.reduce((a, p) => (p.value > a.value ? p : a), items[0]);
  const ph = items.indexOf(peak);
  if (peak.value) peak.best = true;
  const sum = total ? `Чаще всего заходят <b>с ${ph}:00 до ${ph + 1}:00</b>: ${num(peak.value)} ${plural(peak.value, "заход", "захода", "заходов")} ${PNAME[d.period]}.` : "";
  const parts = [["Ночь", 0], ["Утро", 6], ["День", 12], ["Вечер", 18]].map(([name, a]) => ({ name, a, v: items.slice(a, a + 6).reduce((s, p) => s + p.value, 0) }));
  const topPart = Math.max(...parts.map((p) => p.v));
  const tz = TZ === "Europe/Moscow" ? "по московскому времени" : "по времени счётчика";
  return {
    items, sum,
    lead: `Сколько заходов началось в каждый час, ${tz}.${prev ? ` Жёлтая черта: ${gw}.` : ""} Зачем: видно, когда люди заходят и когда лучше выпускать новое.`,
    legend: [["lg-bar", { today: "сегодня", week: "эти 7 дней", month: "эти 30 дней", all: "всё время" }[d.period]], prev && ["lg-ghost", gw],
      today && ["lg-bar part", "этот час ещё идёт"], peak.value && ["lg-bar best", "самый частый час"]],
    parts: `<div class="dayparts">${parts.map((p) => `<div class="dp${total && p.v === topPart ? " top" : ""}"><span>${p.name}, ${p.a}-${p.a + 6} ч</span><b>${pct(p.v, total) || "0%"}</b></div>`).join("")}</div>`,
  };
}
function hoursCard(d) {
  const h = hoursData(d);
  if (!h) return errCard("По часам", d.errors.hours);
  return `<section class="card"><div class="card-head"><div><h2>По часам</h2><p class="lead">${h.lead}</p></div></div>
    ${h.sum ? `<p class="sum">${h.sum}</p>` : ""}<div class="chart" id="hrChart"></div>${legend(h.legend)}${h.parts}</section>`;
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
  const p = d.peopleSum, tw = isTW(d), nm = d.counter.name, inside = tw ? "в TanWin" : "на сайте";
  const [, visits, newUsers, avgDur] = totals(d.now);
  if (p?.maxVisits) items.push({ value: num(p.maxVisits), label: "Больше всех заходов у одного человека", what: `Самый частый ${tw ? "ученик" : "посетитель"} открыл ${nm} ${times(p.maxVisits)} за период.` });
  if (p?.maxTime) items.push({ value: dur(p.maxTime), label: "Больше всех времени у одного человека", what: `Столько провёл ${inside} самый ${tw ? "усердный ученик" : "активный посетитель"} за период.` });
  if (users) items.push({ value: dur((avgDur || 0) * (visits || 0) / users), label: "Время на одного человека", what: `Сколько в среднем провёл ${inside} один человек за период.` });
  if (users) items.push({ value: pct(Math.max(0, users - newUsers), users), label: "Бывали раньше", what: `Доля людей, которые уже открывали ${nm} до этого периода.` });
  if (!items.length) return errCard("Рекорды", d.errors.people || "Нет данных.");
  const dist = p?.count ? `<h3 class="sub-h">Сколько раз заходили за период</h3><div class="bars">${[["1 раз", "Открыли и больше не вернулись."], ["2-3 раза", ""], ["4-7 раз", ""], ["8 раз и больше", tw ? "Постоянные ученики." : "Постоянные посетители."]]
    .map(([name, hint], i) => barRow({ name, value: p.buckets[i], base: Math.max(...p.buckets), hint, note: pct(p.buckets[i], p.count) })).join("")}</div>` : "";
  const lead = tw ? "Самые активные ученики и те, кто возвращается. Зачем: видно, есть ли у TanWin постоянные ученики."
    : "Самые активные посетители и те, кто возвращается. Зачем: видно, есть ли у проекта постоянные посетители.";
  return `<section class="card"><div class="card-head"><div><h2>Рекорды и верность</h2>
    <p class="lead">${lead}</p></div></div>
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

/* Самые частые экраны (у TanWin кроме вкладок) или страницы сайта. */
function screensCard(d) {
  const tw = isTW(d), title = tw ? "Самые частые экраны" : "Самые частые страницы";
  if (!d.screens) return errCard(title, d.errors.screens);
  const tabs = new Set(tw ? TABS.map(([n]) => n) : []);
  const rows = d.screens.filter((x) => !tabs.has(x.name)).slice(0, 8);
  if (!rows.length) return `<section class="card"><h2>${title}</h2><p class="lead">За этот период данных нет.</p></section>`;
  const lead = tw ? "Уроки, тренировки и другие экраны, кроме вкладок. Число: сколько раз экран открыли."
    : "Страницы по названию. Число: сколько раз страницу открыли.";
  return `<section class="card"><div class="card-head"><div><h2>${title}</h2>
    <p class="lead">${lead} Зачем: видно, что людям интереснее всего.</p></div></div>
    <div class="bars">${rows.map((x) => barRow({ name: screenName(x.name), value: x.pv, base: rows[0].pv, note: people(x.users) })).join("")}</div></section>`;
}

/* Цели. У TanWin: всё, что не вошло в путь ученика. У других проектов: цели из Метрики, которые кто-то выполнил. */
function otherGoalsCard(d, users) {
  if (!d.goals?.length || !d.goalStats) return "";
  const tw = isTW(d), g = goalUsers(d);
  const rows = Object.entries(g).filter(([k, x]) => tw ? !PATH.includes(k) && (GOALS[k] || x.users > 0) : x.users > 0 || x.prev > 0).sort((a, b) => b[1].users - a[1].users);
  if (!rows.length) return tw ? "" : `<section class="card"><h2>Цели</h2><p class="lead">За этот период цели никто не выполнил. Цели настраиваются в Метрике.</p></section>`;
  const max = Math.max(1, ...rows.map(([, x]) => x.users));
  const lead = tw ? "Сколько людей хотя бы раз сделали это за период. Процент от всех, кто открыл TanWin."
    : "Сколько людей хотя бы раз выполнили цель за период. Цели настраиваются в Метрике. Процент от всех посетителей.";
  return `<section class="card"><div class="card-head"><div><h2>${tw ? "Что ещё делают" : "Цели"}</h2>
    <p class="lead">${lead}</p></div></div>
    <div class="bars">${rows.map(([k, x]) => barRow({ name: GOALS[k]?.name || x.name, value: x.users, base: max, hint: GOALS[k]?.hint, note: pct(x.users, users), c: change(x.users, x.prev, GOALS[k]?.bad) })).join("")}</div></section>`;
}

/* ---------- Каталог техники ---------- */
const catWait = (d, title) => errCard(title, d.errors.catParams || d.errors.catModels || "Данные каталога ещё загружаются.");
const emptyCard = (title, lead) => `<section class="card"><h2>${esc(title)}</h2><p class="lead">${lead}</p></section>`;
/* Сумма заходов по ключу. */
function sumBy(rows, key) {
  const m = {};
  for (const r of rows) { const k = key(r); if (k) m[k] = (m[k] || 0) + r.visits; }
  return m;
}

/* Путь покупателя: зашли в каталог, открыли страницу модели, выбрали цвет, нажали «Заказать». */
function funnelCard(d, users) {
  if (!d.cat) return catWait(d, "Путь покупателя");
  const g = goalUsers(d), zak = g.zakaz, vyb = g.vybor_cveta, prev = prevTotals(d);
  const rows = [
    barRow({ name: "Зашли в каталог", value: users, base: users, note: users ? "100%" : "", c: prev && change(users, prev[0]), hint: "Все люди за период." }),
    barRow({ name: "Открыли страницу модели", value: d.cat.pageUsers, base: users, note: pct(d.cat.pageUsers, users), hint: "Страница одной модели: все версии, цвета и цены. Сюда приходят и прямо из поиска Яндекса и Google." }),
    barRow({ name: "Выбрали цвет или версию", value: vyb?.users || 0, base: users, note: pct(vyb?.users || 0, users), c: vyb && change(vyb.users, vyb.prev), hint: "Нажали кружок цвета на карточке в каталоге." }),
    barRow({ name: "Нажали «Заказать»", value: zak?.users || 0, base: users, note: pct(zak?.users || 0, users), c: zak && change(zak.users, zak.prev), hint: "Открыли WhatsApp с готовым сообщением о товаре. Само сообщение человек отправляет сам." }),
  ];
  return `<section class="card"><div class="card-head"><div><h2>Путь покупателя</h2>
    <p class="lead">Сколько людей дошли до каждого шага. Процент от всех, кто открыл каталог. Зачем: видно, на каком шаге люди уходят.</p></div></div>
    <div class="bars">${rows.join("")}</div></section>`;
}

/* Популярные модели: страница модели и выбор цвета в каталоге. Рядом сколько раз нажали «Заказать». */
function modelsCard(d) {
  const title = "Популярные модели";
  if (!d.cat) return catWait(d, title);
  const views = Object.fromEntries(d.cat.models.map((x) => [x.name, x.pv]));
  const chose = sumBy(d.cat.choose, (r) => firstPart(r.a)), ordered = sumBy(d.cat.order, (r) => firstPart(r.a));
  const rows = [...new Set([...Object.keys(views), ...Object.keys(chose), ...Object.keys(ordered)])]
    .map((name) => ({ name, look: (views[name] || 0) + (chose[name] || 0), pv: views[name] || 0, ch: chose[name] || 0, ord: ordered[name] || 0 }))
    .sort((a, b) => b.look - a.look || b.ord - a.ord).slice(0, 8);
  if (!rows.length) return emptyCard(title, "За этот период модели ещё не смотрели. Карточка заполнится, когда люди начнут открывать каталог.");
  return `<section class="card"><div class="card-head"><div><h2>${title}</h2>
    <p class="lead">Сколько раз модель смотрели: открыли её страницу или выбирали цвет на карточке в каталоге. Справа: сколько раз нажали «Заказать». Зачем: видно, какие модели держать в наличии и рекламировать.</p></div></div>
    <div class="bars">${rows.map((x) => barRow({ name: x.name, value: x.look, base: rows[0].look, note: `заказов ${num(x.ord)}`, hint: `Страница модели: ${num(x.pv)}, выбор цвета в каталоге: ${num(x.ch)}.` })).join("")}</div></section>`;
}

/* Цвета: какой цвет выбирают и заказывают, по всем моделям вместе. */
function colorsCard(d) {
  const title = "Какие цвета выбирают";
  if (!d.cat) return catWait(d, title);
  const chose = sumBy(d.cat.choose, (r) => firstPart(r.b)), ordered = sumBy(d.cat.order, (r) => firstPart(r.b));
  const rows = [...new Set([...Object.keys(chose), ...Object.keys(ordered)])]
    .map((name) => ({ name, all: (chose[name] || 0) + (ordered[name] || 0), ord: ordered[name] || 0 }))
    .sort((a, b) => b.all - a.all).slice(0, 8);
  if (!rows.length) return emptyCard(title, "За этот период цвет ещё никто не выбирал.");
  return `<section class="card"><div class="card-head"><div><h2>${title}</h2>
    <p class="lead">Сколько раз выбрали цвет или ремешок на карточке и заказали его, все модели вместе. Справа: из них заказов. Зачем: видно, какие цвета брать у поставщика.</p></div></div>
    <div class="bars">${rows.map((x) => barRow({ name: x.name, value: x.all, base: rows[0].all, note: `заказов ${num(x.ord)}` })).join("")}</div></section>`;
}

/* Что заказывают: модель, память и версия целиком. Пока заказов нет: что выбирают. */
function versionsCard(d) {
  if (!d.cat) return catWait(d, "Что заказывают");
  const ord = d.cat.order.length > 0, src = ord ? d.cat.order : d.cat.choose;
  const title = ord ? "Что заказывают" : "Что выбирают";
  const rows = [...src].sort((a, b) => b.visits - a.visits).slice(0, 8);
  if (!rows.length) return emptyCard("Что заказывают", "За этот период «Заказать» ещё никто не нажимал.");
  return `<section class="card"><div class="card-head"><div><h2>${title}</h2>
    <p class="lead">${ord ? "Сколько раз нажали «Заказать» у этой модели, памяти и версии." : "Заказов пока нет. Здесь версии, которые чаще всего выбирали на карточке."} Версия: цвет, страна, SIM. Зачем: видно точный товар, который нужен людям.</p></div></div>
    <div class="bars">${rows.map((x) => barRow({ name: `${x.a} · ${x.b || "без версии"}`, value: x.visits, base: rows[0].visits, note: people(x.users) })).join("")}</div></section>`;
}

/* Что пишут в поиске каталога. */
function searchCard(d) {
  const title = "Что ищут в каталоге";
  if (!d.cat) return catWait(d, title);
  const rows = [...d.cat.search].sort((a, b) => b.visits - a.visits).slice(0, 10);
  if (!rows.length) return emptyCard(title, "За этот период поиском в каталоге не пользовались.");
  return `<section class="card"><div class="card-head"><div><h2>${title}</h2>
    <p class="lead">Слова, которые люди писали в поле поиска на сайте. Число: в скольких заходах. Зачем: видно, какой товар ищут, даже если его нет в наличии.</p></div></div>
    <div class="bars">${rows.map((x) => barRow({ name: `«${x.a}»`, value: x.visits, base: rows[0].visits, note: people(x.users) })).join("")}</div></section>`;
}

/* Разделы каталога, которые нажимают: iPhone, MacBook и другие. */
function catSectionsCard(d) {
  const title = "Какие разделы нажимают";
  if (!d.cat) return catWait(d, title);
  const rows = [...d.cat.section].sort((a, b) => b.visits - a.visits);
  if (!rows.length) return emptyCard(title, "За этот период разделы каталога не нажимали. Все товары видны и без раздела.");
  return `<section class="card"><div class="card-head"><div><h2>${title}</h2>
    <p class="lead">Кнопки над карточками: iPhone, MacBook, iPad и другие. Число: в скольких заходах нажали. Зачем: видно, какой вид техники ищут.</p></div></div>
    <div class="bars">${rows.map((x) => barRow({ name: x.a, value: x.visits, base: rows[0].visits, note: people(x.users) })).join("")}</div></section>`;
}

function errCard(title, msg) {
  return `<section class="card"><h2>${esc(title)}</h2><p class="lead">${esc(msg || "Метрика не отдала эти данные.")}</p></section>`;
}

function helpCard(d) {
  const tw = isTW(d), nm = esc(d.counter.name);
  return `<section class="card"><details class="help"><summary>Как считаются цифры</summary><ul>
    <li><b>Человек</b> для Метрики: один браузер на одном устройстве. Если человек открыл ${nm} на телефоне и на компьютере, он считается дважды.</li>
    <li><b>Заход</b> (визит): человек открыл ${nm} и что-то делал. Если 30 минут ничего не делать, следующий шаг будет уже новым заходом.</li>
    <li><b>Время</b> считается от первого до последнего действия в заходе. Если человек открыл экран и сразу ушёл, время почти нулевое.</li>
    <li><b>Ушли сразу</b> (отказ): заход короче 15 секунд и всего с одним экраном.</li>
    <li><b>Сравнение</b> (▲ и ▼) идёт с таким же отрезком прямо перед выбранным и до того же часа и минуты. «Сегодня» в 14:00 сравнивается со вчерашним днём до 14:00, а не с полным днём.</li>
    <li><b>Цвет значка:</b> зелёный: стало лучше, красный: хуже, серый: изменение меньше 5%, это обычное колебание. Если оба числа меньше 10, вместо процентов видна разница: «+2».</li>
    <li><b>Итог наверху</b> решают ${tw ? "три цифры: люди, пройденные уроки и общее время" : "две цифры: люди и общее время"}. Больше зелёных: «Лучше». Больше красных: «Хуже».</li>
    <li><b>По дням недели:</b> за 7 дней видно каждый день. За «Сегодня» (4 недели до сегодня), 30 дней и всё время: сколько людей в среднем за один такой день. Сегодня в среднее не идёт: день ещё не кончился.</li>
    <li><b>По часам:</b> сколько заходов началось в каждый час, по часам счётчика${TZ === "Europe/Moscow" ? " (Москва)" : ""}.</li>
    ${tw ? `<li><b>«Ещё»</b>: считаются только переходы прямо из «Ещё». Тот же экран, открытый с «Пути» или из уведомления, сюда не попадает.</li>
    <li>Ученики, которые выключили «Анонимную статистику» в TanWin, в цифры не попадают.</li>` : ""}
    ${isKT(d) ? `<li><b>Модели, цвета и поиск</b> считаются по заходам: если человек два раза выбрал один цвет за один заход, это один раз. Эти данные присылает сам сайт каталога.</li>` : ""}
    <li>Данные приходят из Яндекс.Метрики с опозданием в несколько минут.</li>
  </ul></details>
  <div class="foot"><span>Счётчик ${d.counter.id}</span>${installEvt ? `<button class="btn ghost" type="button" id="install">Поставить значок на устройство</button>` : ""}<button class="link-btn" type="button" id="logout">Отключить ключ на этом устройстве</button></div></section>`;
}

/* ---------- Движение, как на сайте C4 Street: вес, пружина, глубина ----------
   Карточки вылетают, буквы падают, цифры отсчитываются, полосы растут. Всё это один раз при открытии
   и при смене периода или проекта: тихое обновление данных показывает новые цифры сразу. */
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
const NUM = /\d+(?:[  ]\d{3})*/g;
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
  let list = readJSON(K_COUNTERS) || [];
  let id = savedId(list);
  $("#topActions").hidden = false;
  drawPeriods(period.id);
  drawProjects(list, id);

  const cached = cacheGet(id, period.id);
  if (cached) { render(cached); stamp(cached.at, true); }
  else {
    shown = null;
    $("#updated").textContent = "Загружаю…";
    app.innerHTML = `<section class="card skeleton"></section><section class="tiles">${'<div class="card skeleton"></div>'.repeat(4)}</section><section class="card skeleton" style="min-height:300px"></section>`;
  }

  if (busy) return;
  busy = true;
  $("#refresh").classList.add("spin");
  let stale = false; // пока шла загрузка, выбрали другой период или проект: загрузить и их
  try {
    list = await counterList();
    if (!list.length) throw new Error("В этом аккаунте Яндекса нет счётчиков Метрики.");
    id = savedId(list);
    drawProjects(list, id);
    const d = await load(period, list.find((c) => c.id === id));
    stale = periodById(store.get(K_PERIOD) || "week").id !== period.id || savedId(list) !== id;
    if (!stale) {
      cacheSet(d);
      render(d);
      stamp(d.at, false);
    }
  } catch (e) {
    if (e instanceof AuthError) { store.del(K_TOKEN); showConnect("Яндекс не принял ключ. Подключи Метрику заново."); return; }
    if (!cached) { $("#updated").textContent = ""; app.innerHTML = `<section class="card"><p class="error">${esc(e.message)}</p></section>`; motion("error"); }
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
  if (e.target.id === "logout") { store.del(K_TOKEN); store.del(K_CACHE); store.del(K_COUNTERS); showConnect(); }
  if (e.target.closest("#proj")) menu($("#projMenu").hidden);
  const item = e.target.closest(".pm-item");
  if (item) {
    menu(false);
    if (item.getAttribute("aria-selected") !== "true") { store.set(K_COUNTER, item.dataset.id); scrollTo({ top: 0 }); start(); }
  }
});
/* Подсказка у столбика и список проектов закрываются, когда нажимают мимо них. Подсказка закрывается и когда страницу листают. */
document.addEventListener("pointerdown", (e) => {
  if (!e.target.closest(".chart")) hideTip();
  if (!e.target.closest("#proj, #projMenu")) menu(false);
});
addEventListener("scroll", hideTip, { passive: true });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") { menu(false); hideTip(); } });
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && store.get(K_TOKEN)) start(); });
let resizeT;
window.addEventListener("resize", () => { clearTimeout(resizeT); resizeT = setTimeout(() => { tapeHalf = 0; menu(false); hideTip(); if (shown) wireCharts(shown); }, 150); });

store.del("tws-cache2"); store.del("tws-cache3"); // память прошлых версий страницы
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
start();
