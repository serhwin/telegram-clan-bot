# Telegram Clan Bot (Render-ready)

## 🚀 Установка на Render

1. Залей проект на GitHub.
2. Перейди в [Render](https://render.com/) → New → Web Service.
3. Подключи GitHub репозиторий.
4. Build Command:
   ```
   composer install
   ```
5. Start Command:
   ```
   php bot.php
   ```
6. Добавь переменные окружения:
   - BOT_TOKEN
   - DB_DSN
   - DB_USER
   - DB_PASS

7. Render выдаст ссылку, например:
   ```
   https://mybot.onrender.com
   ```

8. Установи webhook:
   ```
   curl -X POST "https://api.telegram.org/bot<ТОКЕН>/setWebhook?url=https://mybot.onrender.com"
   ```

✅ Всё, бот готов к работе!
