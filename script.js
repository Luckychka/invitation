/* =========================================================
   Настройки — меняй только этот блок
   ========================================================= */
const CONFIG = {
  name: 'Лиза',          // имя девушки
  telegram: 'Belo0yo',   // твой юзернейм в Telegram (без @)
  notifyUrl: '',         // адрес воркера Cloudflare для уведомлений о заходах
};

/* =========================================================
   Уведомление о заходе на сайт
   ========================================================= */
function notifyVisit() {
  const url = CONFIG.notifyUrl;
  if (!url || !navigator.onLine) return;
  if (sessionStorage.getItem('visitNotified')) return;
  sessionStorage.setItem('visitNotified', '1');

  const payload = {
    screen: `${screen.width}x${screen.height} @${window.devicePixelRatio}x`,
    ua: navigator.userAgent,
    lang: navigator.language,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    ref: document.referrer || '',
  };

  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {});
}

/* =========================================================
   Данные опросника
   ========================================================= */
const MOODS = [
  { icon: '🕯️', title: 'Спокойно и красиво', note: 'Без суеты, посидеть, поговорить', value: 'Спокойно' },
  { icon: '🎉', title: 'Весело и активно', note: 'Чтобы посмеяться и почувствовать себя живыми', value: 'Весёло' },
  { icon: '🤷', title: 'Не знаю, решай ты', note: 'Доверяю тебе полностью', value: 'На твоё усмотрение' },
];

const PLACES = {
  cafe: {
    icon: '☕',
    emoji: '☕',
    label: 'Кафе',
    question: 'Какое кафе тебе зайдёт?',
    options: [
      { icon: '🧁', title: 'Кофе и десерты', note: 'Сладко, можно сидеть хоть три часа', value: 'Кофе и десерты' },
      { icon: '🥂', title: 'Что-нибудь серьёзное', note: 'Ужин' },
      { icon: '🥐', title: 'Быстро по-простому', note: 'Кофе с собой и болтовня', value: 'Кофе и болтовня' },
    ],
  },
  cinema: {
    icon: '🎬',
    emoji: '🎬',
    label: 'Кино',
    question: 'Что будем смотреть?',
    options: [
      { icon: '😂', title: 'Комедию', note: 'Посмеяться и забыть про всё', value: 'Комедия' },
      { icon: '✨', title: 'Что-нибудь красивое', note: 'Мелодрама, которую обсудим потом', value: 'Красивый фильм' },
      { icon: '🐻', title: 'Большой мультик', note: 'Легко, смешно, без лишних мыслей', value: 'Мультик в кинотеатре' },
      { icon: '🤷', title: 'На твой выбор', note: 'Доверяю тебе', value: 'Фильм на твой выбор' },
    ],
  },
  walk: {
    icon: '🌇',
    emoji: '🌇',
    label: 'Прогулка',
    question: 'Куда пойдём гулять?',
    options: [
      { icon: '🏙️', title: 'Центр и огни', note: 'Гулять, смотреть, залипать', value: 'Прогулка по центру' },
      { icon: '🌳', title: 'Парк и тишина', note: 'Погулять, подышать, поговорить обо всём', value: 'Прогулка в парке' },
      { icon: '🧭', title: 'Куда глаза глядят', note: 'Без плана — так часто бывает лучше', value: 'Спонтанная прогулка' },
    ],
  },
};

const PLACE_ORDER = ['cafe', 'cinema', 'walk'];

const TIMES = ['17:00', '18:00', '19:00', '20:00', '21:00', '22:00'];

/* =========================================================
   Состояние
   ========================================================= */
const state = {
  mood: null,
  place: null,
  detail: null,
  date: null,    // 'YYYY-MM-DD'
  time: null,    // 'HH:MM'
};

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

const card = document.getElementById('card');
const topbar = document.getElementById('topbar');
const backBtn = document.getElementById('backBtn');
const progress = document.getElementById('progress');
const counter = document.getElementById('counter');
const hint = document.getElementById('hint');
const toast = document.getElementById('toast');

const TOTAL_STEPS = 6;
let stepIndex = 0;

progress.innerHTML = Array.from({ length: TOTAL_STEPS }, () => '<span class="progress__dot"></span>').join('');

/* =========================================================
   Помощники
   ========================================================= */
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function showToast(text) {
  toast.textContent = text;
  toast.classList.add('is-visible');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove('is-visible'), 4200);
}

function toISODate(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

function parseISODate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(iso) {
  if (!iso) return '—';
  const date = parseISODate(iso);
  const days = Math.round((date - TODAY) / 86400000);
  const chunks = date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }).split(', ');
  const human = chunks.length > 1 ? `${chunks[0]} ${chunks[1]}` : chunks[0];
  if (days === 0) return `сегодня, ${human}`;
  if (days === 1) return `завтра, ${human}`;
  if (days === 2) return `послезавтра, ${human}`;
  return human;
}

function optionHTML(opt, i, selectedValue, className = '') {
  const picked = selectedValue === opt.value;
  return `
    <button class="option ${className}" type="button" data-value="${esc(opt.value)}" data-i="${i}"
            style="animation-delay:${i * 55}ms" aria-pressed="${picked}">
      <span class="tick">✓</span>
      ${opt.icon ? `<span class="option__icon">${opt.icon}</span>` : ''}
      <span class="option__title">${esc(opt.title)}</span>
      ${opt.note ? `<span class="option__note">${esc(opt.note)}</span>` : ''}
    </button>`;
}

/* =========================================================
   Экраны
   ========================================================= */
/* Блок-кнопка на случай, если автопереход в Telegram не сработал.
   Одинаковый для всех экранов, поэтому вынесен отдельно. */
function sendFallbackHTML(note) {
  return `
    <div class="send-fallback" id="sendFallback" hidden>
      <a class="btn btn--yes" id="openTgApp" href="#">Открыть чат в Telegram</a>
      <a class="btn btn--ghost" id="openTgWeb" href="#" target="_blank" rel="noopener">Открыть в обычном браузере</a>
      <p class="note">${note}</p>
    </div>`;
}

function introScreen() {
  return `
    <span class="eyebrow">для тебя</span>
    <h1 class="title">${CONFIG.name}, тут кое-что <em>для тебя</em></h1>
    <p class="subtitle">
      Небольшое приглашение.
      Ответь на пару вопросов, выбери удобное время, и я всё устрою.
    </p>
    <div class="actions">
      <button class="btn btn--primary" type="button" id="startBtn">Смотреть, что там </button>
    </div>
    <div class="actions actions--quiet">
      <button class="btn btn--quiet" type="button" id="declineBtn">Пока не надо</button>
    </div>
    <p class="note" id="copyNote"></p>
    ${sendFallbackHTML('Сайт открыт внутри Telegram — нажми первую кнопку, сообщение уже будет в поле отправки.')}`;
}

function moodScreen() {
  return `
    <span class="eyebrow">шаг 1</span>
    <h2 class="title">Как настроение на вечер?</h2>
    <p class="subtitle">Чтобы я понимал, в какую сторону ставить.</p>
    <div class="options options--three" data-options="mood">
      ${MOODS.map((o, i) => optionHTML(o, i, state.mood)).join('')}
    </div>`;
}

function placeScreen() {
  const notes = {
    cafe: 'Сладко и без спешки',
    cinema: 'Красиво и спокойно',
    walk: 'Город, вечер, свежий воздух',
  };
  return `
    <span class="eyebrow">шаг 2</span>
    <h2 class="title">Куда идём?</h2>
    <p class="subtitle">Три варианта — выбирай любой, все хорошие.</p>
    <div class="options options--three" data-options="place">
      ${PLACE_ORDER.map((key, i) => {
        const p = PLACES[key];
        return optionHTML({ icon: p.icon, title: p.label, note: notes[key], value: key }, i, state.place);
      }).join('')}
    </div>`;
}

function detailScreen() {
  const p = PLACES[state.place] || PLACES.cafe;
  return `
    <span class="eyebrow">шаг 3</span>
    <h2 class="title">${esc(p.question)}</h2>
    <p class="subtitle">Детали — чтобы я заранее понимал, куда меняться и что заказывать.</p>
    <div class="options options--two" data-options="detail">
      ${p.options.map((o, i) => optionHTML(o, i, state.detail)).join('')}
    </div>`;
}

function dateScreen() {
  const quick = [
    { value: toISODate(TODAY), title: 'Сегодня', note: 'почти не успела, но успеем' },
    { value: toISODate(new Date(TODAY.getTime() + 86400000)), title: 'Завтра', note: 'я готов' },
    { value: toISODate(new Date(TODAY.getTime() + 2 * 86400000)), title: 'Послезавтра', note: 'если сегодня не выйдет' },
  ].map((o) => ({ ...o, icon: '' }));

  return `
    <span class="eyebrow">шаг 4</span>
    <h2 class="title">Когда тебе удобно?</h2>
    <p class="subtitle">Выбери день или напиши свой.</p>
    <div class="options options--three" data-options="date">
      ${quick.map((o, i) => optionHTML(o, i, state.date)).join('')}
    </div>
    <label class="date-row" style="margin-top:12px">
      <span>Другая дата</span>
      <input type="date" id="dateInput" min="${toISODate(TODAY)}" value="${state.date || ''}">
    </label>`;
}

function timeScreen() {
  const chips = TIMES.map((t) => ({ icon: '', title: t, value: t }));
  return `
    <span class="eyebrow">шаг 5</span>
    <h2 class="title">Во сколько встречаемся?</h2>
    <p class="subtitle">Вечер — значит примерно так. Можно и другое время.</p>
    <div class="options options--chips" data-options="time">
      ${chips.map((o, i) => optionHTML(o, i, state.time, 'chip')).join('')}
    </div>
    <label class="date-row" style="margin-top:12px">
      <span>Другое время</span>
      <input type="time" id="timeInput" value="${state.time || ''}">
    </label>`;
}

function finalScreen() {
  const place = PLACES[state.place] || PLACES.cafe;
  return `
    <span class="eyebrow">шаг 6 · всё готово</span>
    <h2 class="title">${CONFIG.name}, ну что — <em>согласна?</em></h2>
    <p class="subtitle">Ниже всё, что ты выбрала. Если всё верно — жми кнопку, и я буду готовиться.</p>

    <dl class="summary">
      <div><dt>Настроение</dt><span>${esc(state.mood)}</span></div>
      <div><dt>Место</dt><span>${place.emoji} ${esc(place.label)}</span></div>
      <div><dt>Детали</dt><span>${esc(state.detail)}</span></div>
      <div><dt>День</dt><span>${esc(formatDate(state.date))}</span></div>
      <div><dt>Время</dt><span>${esc(state.time)}</span></div>
    </dl>

    <div class="actions">
      <button class="btn btn--yes" type="button" id="agreeBtn">Я согласна! </button>
    </div>

    <div class="send-fallback-slot">${sendFallbackHTML('Сайт открыт внутри Telegram — поэтому текст не мог подставиться сам. Нажми первую кнопку: сообщение уже будет в поле отправки.')}</div>

    <p class="note" id="copyNote"></p>
    <p class="note" style="margin-top:4px">
      <button type="button" class="linkish" id="restartBtn">Заполнить заново</button>
    </p>`;
}

/* =========================================================
   Логика шагов
   ========================================================= */
const RENDERERS = [introScreen, moodScreen, placeScreen, detailScreen, dateScreen, timeScreen, finalScreen];

function optionsKey() {
  return ['intro', 'mood', 'place', 'detail', 'date', 'time', 'final'][stepIndex];
}

function canEnter(i) {
  switch (i) {
    case 2: return !!state.mood;
    case 3: return !!state.place;
    case 4: return !!state.detail;
    case 5: return !!state.date;
    case 6: return !!state.time;
    default: return true;
  }
}

function render(direction = 0) {
  card.innerHTML = RENDERERS[stepIndex]();
  card.classList.remove('is-forward', 'is-back');
  if (direction > 0) card.classList.add('is-forward');
  else if (direction < 0) card.classList.add('is-back');

  const isIntro = stepIndex === 0;
  topbar.hidden = isIntro;
  hint.textContent = isIntro
    ? 'Ничего страшного'
    : 'Нажимай на варианты — двигаться можно и назад';

  if (!isIntro) {
    [...progress.children].forEach((dot, i) => {
      dot.classList.toggle('is-done', i < stepIndex);
      dot.classList.toggle('is-active', i === stepIndex);
    });
    progress.setAttribute('aria-valuenow', String(stepIndex));
    counter.textContent = `${stepIndex}/${TOTAL_STEPS}`;
  }

  backBtn.disabled = isIntro;
  bind();
}

function go(delta) {
  const next = Math.min(RENDERERS.length - 1, Math.max(0, stepIndex + delta));
  if (next !== stepIndex && canEnter(next)) {
    stepIndex = next;
    render(delta);
  }
}

function bind() {
  const key = optionsKey();

  card.querySelectorAll('[data-options]').forEach((box) => {
    box.querySelectorAll('.option').forEach((btn) => {
      btn.addEventListener('click', () => {
        box.querySelectorAll('.option').forEach((b) => {
          b.classList.remove('is-selected');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('is-selected');
        btn.setAttribute('aria-pressed', 'true');

        if (key === 'date') {
          state.date = btn.dataset.value;
          document.getElementById('dateInput').value = state.date;
        } else {
          state[key] = btn.dataset.value;
        }

        setTimeout(() => go(1), 260);
      });
    });
  });

  const startBtn = document.getElementById('startBtn');
  if (startBtn) startBtn.addEventListener('click', () => go(1));

  const declineBtn = document.getElementById('declineBtn');
  if (declineBtn) declineBtn.addEventListener('click', declineInTelegram);

  const dateInput = document.getElementById('dateInput');
  if (dateInput) {
    dateInput.addEventListener('change', () => {
      if (!dateInput.value) return;
      state.date = dateInput.value;
      card.querySelectorAll('[data-options="date"] .option').forEach((b) => {
        const picked = b.dataset.value === state.date;
        b.classList.toggle('is-selected', picked);
        b.setAttribute('aria-pressed', String(picked));
      });
      setTimeout(() => go(1), 200);
    });
  }

  const timeInput = document.getElementById('timeInput');
  if (timeInput) {
    timeInput.addEventListener('change', () => {
      if (!timeInput.value) return;
      state.time = timeInput.value;
      card.querySelectorAll('[data-options="time"] .option').forEach((b) => {
        const picked = b.dataset.value === state.time;
        b.classList.toggle('is-selected', picked);
        b.setAttribute('aria-pressed', String(picked));
      });
      setTimeout(() => go(1), 200);
    });
  }

  const agreeBtn = document.getElementById('agreeBtn');
  if (agreeBtn) agreeBtn.addEventListener('click', sendToTelegram);

  const restartBtn = document.getElementById('restartBtn');
  if (restartBtn) {
    restartBtn.addEventListener('click', () => {
      Object.assign(state, { mood: null, place: null, detail: null, date: null, time: null });
      stepIndex = 0;
      render();
    });
  }
}

/* =========================================================
   Финал → Telegram
   ========================================================= */
function buildMessage() {
  const place = PLACES[state.place] || PLACES.cafe;
  const lines = [
    `Я согласна!`,
    '',
    'Мы выбрали:',
    `• Настроение: ${state.mood || '—'}`,
    `• Место: ${place.label}`,
    `• Детали: ${state.detail || '—'}`,
    `• Когда: ${formatDate(state.date)}, ${state.time || '—'}`,
    '',
    'Всё забронировано, до встречи! ✨',
  ];
  return lines.join('\n');
}

function buildDeclineMessage() {
  return [
    'Пока не надо',
    '',
    'Но всё равно спасибо, что заглянула.',
    'Было очень приятно.',
  ].join('\n');
}

function setNote(text) {
  const note = document.getElementById('copyNote');
  if (note) note.textContent = text || '';
}

const IS_MOBILE = /Android|iPhone|iPad|iPod|iPodTouch|Mobile|Silk|Kindle/i.test(navigator.userAgent)
  || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(pointer: fine)').matches);

// Сайт открыт во встроенном браузере Telegram: tg://-переходы там заблокированы,
// текст сам не подставится — показываем кнопки, которые открывают приложение по нажатию.
const IN_TELEGRAM = /Telegram|TelegramBot|Telegram-iOS/i.test(navigator.userAgent)
  || !!window.TelegramWebview
  || /(^|\.)telegram\.org|t\.me/i.test(document.referrer || '');

function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => copyFallback(text));
  }
  return Promise.resolve(copyFallback(text));
}

function copyFallback(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, ta.value.length);
  const ok = document.execCommand ? document.execCommand('copy') : false;
  document.body.removeChild(ta);
  return !!ok;
}

function sendToTelegram() {
  openTelegram(buildMessage(), 'Открой чат в Telegram и напиши «согласна» — детали я уже знаю.');
}

function declineInTelegram() {
  openTelegram(buildDeclineMessage(), 'Открой чат в Telegram и напиши «пока не надо» — я всё понял.');
}

function openTelegram(message, failNote) {
  const user = encodeURIComponent(CONFIG.telegram);
  const enc = encodeURIComponent(message);

  // 1) tg://resolve — Telegram сразу открывает чат с уже набранным текстом.
  const deepLink = `tg://resolve?domain=${user}&text=${enc}`;
  // 2) Официальная share-ссылка: открывает выбор чата, текст уже лежит в поле.
  const shareLink = `https://t.me/share/url?url=${enc}`;
  // 3) Просто чат (последний вариант).
  const webLink = `https://t.me/${user}?text=${enc}`;

  copyText(message).then((copied) => {
    if (!copied) {
      setNote(failNote);
      showToast('Не получилось скопировать текст автоматически');
      return;
    }
    setNote(IN_TELEGRAM
      ? 'Текст скопирован. Нажми «Открыть чат в Telegram» — сообщение будет в поле отправки.'
      : IS_MOBILE
        ? 'Текст скопирован. Открываю Telegram — сообщение должно быть в поле отправки.'
        : 'Текст сообщения скопирован — если Telegram не подставил его сам, просто вставь в чат.');
    showToast('Готово! Открываю Telegram');
  });

  // Кнопки-страховка: их прячем заранее и показываем, если автопереход не сработал.
  const box = document.getElementById('sendFallback');
  const appLink = document.getElementById('openTgApp');
  const webBtn = document.getElementById('openTgWeb');
  const showFallback = () => {
    if (appLink) appLink.href = webLink;
    if (webBtn) webBtn.href = shareLink;
    if (box) box.hidden = false;
  };
  showFallback();

  // Во встроенном браузере Telegram автопереход не сработает — только по нажатию.
  if (IN_TELEGRAM) {
    showFallback();
    return;
  }

  if (!IS_MOBILE) {
    const opened = window.open(webLink, '_blank', 'noopener');
    if (!opened) {
      window.location.href = webLink;
      showFallback();
    }
    return;
  }

  // Пробуем варианты по очереди, пока страница остаётся открытой —
  // значит ни один из них не перехватил пользователя.
  const steps = [deepLink, shareLink, webLink];
  let i = 0;
  const tryNext = () => {
    if (document.visibilityState !== 'visible') return; // ушли в Telegram
    if (i >= steps.length) {
      showFallback();
      return;
    }
    window.location.href = steps[i++];
    setTimeout(tryNext, 1800);
  };
  window.location.href = deepLink;
  setTimeout(tryNext, 1800);
}

/* =========================================================
   Фоновые эффекты
   ========================================================= */
const GLYPHS = ['✨', '🦋', '☕', '✦', '✧', '🎈', '💫'];

function spawnAmbient() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const box = document.getElementById('ambient');
  if (!box) return;

  const count = window.innerWidth < 600 ? 12 : 18;

  for (let i = 0; i < count; i++) {
    const span = document.createElement('span');
    span.textContent = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
    span.style.left = `${2 + Math.random() * 94}%`;
    span.style.fontSize = `${14 + Math.random() * 18}px`;
    span.style.animationDuration = `${26 + Math.random() * 26}s`;
    span.style.animationDelay = `${-Math.random() * 50}s`;
    box.appendChild(span);
  }
}

/* =========================================================
   Старт
   ========================================================= */
backBtn.addEventListener('click', () => go(-1));
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') go(-1);
});

spawnAmbient();
notifyVisit();
render();