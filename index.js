const express = require('express');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
require('dotenv').config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const PORT = process.env.PORT || 10000;
const BASE_URL = (process.env.BASE_URL || '').replace(/\/$/, ''); // without trailing slash
const ADMIN_USERNAMES = (process.env.ADMIN_USERNAMES || '').split(',').map(s=>s.trim()).filter(Boolean);

if (!BOT_TOKEN) { console.error('BOT_TOKEN is required'); process.exit(1); }

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function initDb() {
  const db = await open({
    filename: './database.sqlite',
    driver: sqlite3.Database
  });
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      telegram_id INTEGER PRIMARY KEY,
      username TEXT,
      nickname TEXT,
      country TEXT,
      messages INTEGER DEFAULT 0,
      gifts INTEGER DEFAULT 0,
      popularity INTEGER DEFAULT 0,
      role TEXT DEFAULT 'player',
      last_message_at INTEGER DEFAULT 0,
      banned INTEGER DEFAULT 0
    );
  `);
  return db;
}

async function tgSend(method, params) {
  try {
    const res = await axios.post(`${TELEGRAM_API}/${method}`, params);
    return res.data;
  } catch (e) {
    console.error('tgSend error', e.response?.data || e.message);
  }
}

(async () => {
  const db = await initDb();
  const app = express();
  app.use(express.json());

  app.post('/', async (req, res) => {
    const update = req.body;
    // support message and channel_post etc.
    const msg = update.message || update.channel_post || null;
    if (!msg) { res.send('ok'); return; }

    // handle new members
    if (msg.new_chat_members) {
      for (const m of msg.new_chat_members) {
        const name = m.username ? '@'+m.username : (m.first_name || 'игрок');
        await tgSend('sendMessage', { chat_id: msg.chat.id, text: `👋 Привет, ${name}! Укажи свой ник и страну:\n/setnick <ник> <страна>` });
      }
      res.send('ok'); return;
    }

    const chatId = msg.chat.id;
    const from = msg.from || {};
    const userId = from.id;
    const username = from.username || null;
    const text = (msg.text || '').trim();

    // Ensure user row exists
    const exists = await db.get('SELECT telegram_id FROM users WHERE telegram_id = ?', userId);
    if (!exists) {
      await db.run('INSERT INTO users (telegram_id, username) VALUES (?, ?)', userId, username);
      // if username in ADMIN_USERNAMES, set role admin
      if (username && ADMIN_USERNAMES.includes(username)) {
        await db.run('UPDATE users SET role = ? WHERE telegram_id = ?', 'admin', userId);
      }
    } else {
      // update username if changed
      await db.run('UPDATE users SET username = ? WHERE telegram_id = ?', username, userId);
    }

    // Check ban
    const me = await db.get('SELECT * FROM users WHERE telegram_id = ?', userId);
    if (me.banned) {
      // optionally notify
      res.send('ok'); return;
    }

    // Commands handling
    if (text.startsWith('/')) {
      const parts = text.split(/\s+/);
      const cmd = parts[0].toLowerCase();
      if (cmd === '/setnick') {
        if (parts.length >= 3) {
          const nick = parts[1];
          const country = parts.slice(2).join(' ');
          await db.run('UPDATE users SET nickname = ?, country = ? WHERE telegram_id = ?', nick, country, userId);
          await tgSend('sendMessage', { chat_id: chatId, reply_to_message_id: msg.message_id, text: `✅ Ник сохранён: ${nick} | ${country}` });
        } else {
          await tgSend('sendMessage', { chat_id: chatId, reply_to_message_id: msg.message_id, text: '❌ Используй: /setnick <ник> <страна>' });
        }
        res.send('ok'); return;
      }

      if (cmd === '/me') {
        const u = await db.get('SELECT * FROM users WHERE telegram_id = ?', userId);
        const nick = u.nickname || u.username || '—';
        const country = u.country || '—';
        await tgSend('sendMessage', { chat_id: chatId, reply_to_message_id: msg.message_id, text: `👤 ${nick} | ${country}\n💬 Сообщений: ${u.messages}\n🎁 Подарков: ${u.gifts}\n❤️ Популярность: ${u.popularity}` });
        res.send('ok'); return;
      }

      if (cmd === '/players') {
        const rows = await db.all('SELECT nickname, country, popularity FROM users ORDER BY nickname COLLATE NOCASE');
        if (!rows.length) {
          await tgSend('sendMessage', { chat_id: chatId, text: 'Пока нет игроков.' });
        } else {
          let out = '📋 Игроки:\n';
          rows.forEach((r,i)=> out += `${i+1}. ${r.nickname || '—'} | ${r.country || '—'} | ❤️ ${r.popularity}\n`);
          await tgSend('sendMessage', { chat_id: chatId, text: out });
        }
        res.send('ok'); return;
      }

      if (cmd === '/who') {
        const mention = parts[1] ? parts[1].replace('@','') : null;
        if (!mention) {
          await tgSend('sendMessage', { chat_id: chatId, reply_to_message_id: msg.message_id, text: '❌ Используй: /who @username' });
          res.send('ok'); return;
        }
        const row = await db.get('SELECT nickname,country FROM users WHERE username = ?', mention);
        if (row) {
          await tgSend('sendMessage', { chat_id: chatId, reply_to_message_id: msg.message_id, text: `@${mention} = ${row.nickname || '—'} | ${row.country || '—'}` });
        } else {
          await tgSend('sendMessage', { chat_id: chatId, reply_to_message_id: msg.message_id, text: '❌ Ник не найден' });
        }
        res.send('ok'); return;
      }

      if (cmd === '/gifts') {
        const u = await db.get('SELECT gifts FROM users WHERE telegram_id = ?', userId);
        await tgSend('sendMessage', { chat_id: chatId, reply_to_message_id: msg.message_id, text: `🎁 У тебя: ${u.gifts} курочек` });
        res.send('ok'); return;
      }

      if (cmd === '/gift') {
        const mention = parts[1] ? parts[1].replace('@','') : null;
        if (!mention) {
          await tgSend('sendMessage', { chat_id: chatId, reply_to_message_id: msg.message_id, text: '❌ Используй: /gift @username' });
          res.send('ok'); return;
        }
        const target = await db.get('SELECT * FROM users WHERE username = ?', mention);
        if (!target) {
          await tgSend('sendMessage', { chat_id: chatId, reply_to_message_id: msg.message_id, text: '❌ Пользователь не зарегистрирован' });
          res.send('ok'); return;
        }
        if (me.gifts <= 0) {
          await tgSend('sendMessage', { chat_id: chatId, reply_to_message_id: msg.message_id, text: '❌ У тебя нет подарков' });
          res.send('ok'); return;
        }
        // transfer gift
        await db.run('UPDATE users SET gifts = gifts - 1 WHERE telegram_id = ?', userId);
        await db.run('UPDATE users SET gifts = gifts + 1, popularity = popularity + 10 WHERE telegram_id = ?', target.telegram_id);
        await tgSend('sendMessage', { chat_id: chatId, text: `🎉 @${me.username || 'user'} подарил курочку @${target.username || 'user'}! +10 популярности` });
        res.send('ok'); return;
      }

      if (cmd === '/top') {
        const rows = await db.all('SELECT nickname, popularity FROM users ORDER BY popularity DESC LIMIT 10');
        if (!rows.length) {
          await tgSend('sendMessage', { chat_id: chatId, text: 'Пока нет данных.' });
        } else {
          let out = '🏆 Топ по популярности:\n';
          rows.forEach((r,i)=> out += `${i+1}. ${r.nickname || '—'} — ${r.popularity}\n`);
          await tgSend('sendMessage', { chat_id: chatId, text: out });
        }
        res.send('ok'); return;
      }

      if (cmd === '/top_messages') {
        const rows = await db.all('SELECT nickname, messages FROM users ORDER BY messages DESC LIMIT 10');
        let out = '🏅 Топ по сообщениям:\n';
        rows.forEach((r,i)=> out += `${i+1}. ${r.nickname || '—'} — ${r.messages}\n`);
        await tgSend('sendMessage', { chat_id: chatId, text: out });
        res.send('ok'); return;
      }

      // admin commands: ban, unban, reset
      if (cmd === '/ban' || cmd === '/unban' || cmd === '/reset') {
        // check role
        const caller = await db.get('SELECT role FROM users WHERE telegram_id = ?', userId);
        if (!caller || caller.role !== 'admin') {
          await tgSend('sendMessage', { chat_id: chatId, reply_to_message_id: msg.message_id, text: '🚫 Команда доступна только admin' });
          res.send('ok'); return;
        }
        const mention = parts[1] ? parts[1].replace('@','') : null;
        if (!mention) {
          await tgSend('sendMessage', { chat_id: chatId, reply_to_message_id: msg.message_id, text: '❌ Укажите пользователя: /ban @username' });
          res.send('ok'); return;
        }
        const target = await db.get('SELECT * FROM users WHERE username = ?', mention);
        if (!target) {
          await tgSend('sendMessage', { chat_id: chatId, reply_to_message_id: msg.message_id, text: '❌ Пользователь не найден' });
          res.send('ok'); return;
        }
        if (cmd === '/ban') {
          await db.run('UPDATE users SET banned = 1 WHERE telegram_id = ?', target.telegram_id);
          await tgSend('sendMessage', { chat_id: chatId, text: `🚫 @${mention} заблокирован` });
        } else if (cmd === '/unban') {
          await db.run('UPDATE users SET banned = 0 WHERE telegram_id = ?', target.telegram_id);
          await tgSend('sendMessage', { chat_id: chatId, text: `✅ @${mention} разбанен` });
        } else if (cmd === '/reset') {
          await db.run('UPDATE users SET messages = 0, gifts = 0, popularity = 0 WHERE telegram_id = ?', target.telegram_id);
          await tgSend('sendMessage', { chat_id: chatId, text: `♻️ Статистика @${mention} сброшена` });
        }
        res.send('ok'); return;
      }

      // unknown command
      await tgSend('sendMessage', { chat_id: chatId, reply_to_message_id: msg.message_id, text: '❓ Неизвестная команда' });
      res.send('ok'); return;
    } // end commands

    // Non-command message: increment counters, award gifts on each 5 messages, reply signature
    // Update messages count and last_message_at
    const now = Math.floor(Date.now()/1000);
    await db.run('UPDATE users SET messages = messages + 1, last_message_at = ? WHERE telegram_id = ?', now, userId);

    // fetch updated user
    const updated = await db.get('SELECT * FROM users WHERE telegram_id = ?', userId);

    // award gift for each 5 messages
    if (updated.messages > 0 && updated.messages % 5 === 0) {
      await db.run('UPDATE users SET gifts = gifts + 1 WHERE telegram_id = ?', userId);
      await tgSend('sendMessage', { chat_id: chatId, reply_to_message_id: msg.message_id, text: '🎁 Ты получил курочку за активность!' });
    }

    // signature reply
    const nick = updated.nickname || updated.username || '—';
    const country = updated.country || '—';
    const signature = `🔹 Ник: ${nick} | ${country} | ❤️ ${updated.popularity} | 🎁 ${updated.gifts}`;
    await tgSend('sendMessage', { chat_id: chatId, reply_to_message_id: msg.message_id, text: signature });

    res.send('ok');
  });

  // optional endpoint to set webhook (for convenience)
  app.get('/setwebhook', async (req, res) => {
    if (!BASE_URL) return res.send('Set BASE_URL in env');
    const url = BASE_URL;
    const r = await tgSend('setWebhook', { url });
    res.json(r);
  });

  app.listen(PORT, () => {
    console.log('Bot started on port', PORT);
    if (BASE_URL) console.log('BASE_URL:', BASE_URL);
  });
})();
