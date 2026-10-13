/* =========================================================
   Cloudflare Worker — присылает уведомление в Telegram
   при каждом заходе на сайт.

   Настройка (один раз):
   1. Создай бота у @BotFather, получи токен вида 123456:ABC...
   2. Напиши боту /start из «Избранного» (чтобы Worker знал, куда писать).
   3. Cloudflare Dashboard → Workers & Pages → Create → Paste in editor,
      вставь этот файл.
   4. Settings → Variables → Secrets:
        BOT_TOKEN = токен от BotFather
        CHAT_ID   = твой chat id (Worker покажет его, если открыть
                    адрес воркера с ?test=1 и он не найдёт CHAT_ID)
   5. Открой адрес воркера с ?test=1 — должно прийти тестовое сообщение.
   ========================================================= */

const CF_GEO = (request) => ({
  country: request.cf?.country || '',
  city: request.cf?.city || '',
});

function formatText(data, place) {
  const time = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
  const lines = [
    '🌐 Сайт открыли',
    '',
    `🕒 ${time} (МСК)`,
    `📱 ${data.screen || '—'}, ${data.ua || '—'}`,
    `🗂 Язык: ${data.lang || '—'}`,
    `🕐 Часовой пояс: ${data.tz || '—'}`,
  ];
  if (place.city || place.country) {
    lines.push(`📍 ${place.city || ''} ${place.country || ''}`.trim());
  }
  lines.push(`🔗 Откуда: ${data.ref || 'прямая ссылка'}`);
  return lines.join('\n');
}

async function sendTelegram(env, text) {
  const res = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: env.CHAT_ID,
      text,
      disable_web_page_preview: true,
    }),
  });
  return res.json();
}

// Если CHAT_ID ещё не задан — берём его из последнего сообщения боту.
async function discoverChatId(env) {
  const res = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/getUpdates`);
  const data = await res.json();
  const updates = data.result || [];
  for (let i = updates.length - 1; i >= 0; i--) {
    const chat = updates[i].message?.chat || updates[i].my_chat_member?.chat;
    if (chat?.id) return String(chat.id);
  }
  return null;
}

async function handle(request, env) {
  const url = new URL(request.url);

  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

if (request.method === 'GET' && url.searchParams.get('test')) {
    if (!env.BOT_TOKEN) return new Response('Нет секрета BOT_TOKEN', { status: 500, headers: cors });
    if (!env.CHAT_ID) {
      const found = await discoverChatId(env);
      return new Response(
        found
          ? `Найден chat_id: ${found}. Добавь переменную CHAT_ID = ${found}`
          : 'CHAT_ID не задан, и бот не видел ни одного сообщения. Напиши боту /start и повтори.',
        { headers: cors },
      );
    }
    const res = await sendTelegram(env, '✅ Тестовое уведомление настроен — всё работает.');
    return new Response(JSON.stringify(res), { headers: { ...cors, 'Content-Type': 'application/json' } });
  }

  if (request.method !== 'POST') return new Response('ok', { headers: cors });

  let data = {};
  try {
    data = await request.json();
  } catch {
    data = {};
  }

  if (!env.BOT_TOKEN || !env.CHAT_ID) return new Response('Не настроено', { status: 500, headers: cors });

  await sendTelegram(env, formatText(data, CF_GEO(request)));
  return new Response('ok', { headers: cors });
}

export default {
  fetch: (request, ctx, env) => handle(request, env),
};