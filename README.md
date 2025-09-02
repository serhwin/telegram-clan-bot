# Telegram Clan Bot (Node.js) — Render-ready

Этот бот для Telegram реализует функционал клана с механикой популярных подарков (как в PUBG):
- регистрация ник/страна
- подпись под каждым сообщением (reply) с ником, страной, популярностью и подарками
- чат-статистика (сообщения, подарки, популярность)
- подарки выдаются за активность (каждые 5 сообщений даётся 1 "курочка")
- дарение подарков между игроками (/gift @username)
- рейтинги по популярности и активности
- базовая админская система (бан, unban, reset)
- хранение данных в SQLite (database.sqlite) — бесплатно

## Развёртывание на Render (шаги)

1. Создай репозиторий на GitHub и залей все файлы из этого проекта.
2. На Render → New → Web Service → Connect GitHub repo → выбери этот репозиторий.
3. Build Command: `npm install`
4. Start Command: `node index.js`
5. В Environment добавь переменные:
   - BOT_TOKEN
   - PORT (необязательно)
   - BASE_URL (URL приложения на Render, например https://mybot.onrender.com)
   - ADMIN_USERNAMES (опционально, список admin username через запятую)

6. После деплоя установи webhook (замени <TOKEN> и <URL>):
```
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook?url=<BASE_URL>"
```

## Команды в чате
- `/setnick <ник> <страна>` — зарегистрировать ник и страну (рекомендуется)
- `/me` — показать профиль (ник, страна, сообщения, подарки, популярность)
- `/players` — список игроков
- `/who @username` — узнать ник/страну по username
- `/gifts` — показать свои подарки
- `/gift @username` — подарить одну "курочку" другому игроку (+10 популярности)
- `/top` — топ по популярности
- `/top_messages` — топ по сообщениям
- `/ban @username` — (admin) забанить
- `/unban @username` — (admin) разбанить
- `/reset @username` — (admin) сбросить статистику игрока

## Примечания
- SQLite база `database.sqlite` хранится в репозитории на Render и бесплатна.
- Для первой настройки добавь себя в ADMIN_USERNAMES или вручную присвой роль admin в БД.

Удачи!