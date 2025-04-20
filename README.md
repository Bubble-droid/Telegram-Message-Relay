# 一个简单的 Telegram 消息转发机器人

### 快速开始
1. Clone project to local

```bash
git clone https://github.com/Bubble-droid/Telegram-Message-Relay.git
cd Telegram-Message-Relay
```

2. Install dependencies

```bash
npm install
```

3. Log in to the Cloudflare account

```bash
npx wrangler login
```

4. Create kV namespace

```bash
npx wrangler kv namespace create MESSAGE_RELAY_KV
npx wrangler kv namespace create TELEGRAM_BOT_CONFIG_KV
```

5. Configure wrangler.json

```json
{
    "vars": {
        "TELEGRAM_BOT_ID": "YOUR_BOT_ID",
        "TELEGRAM_BOT_NAME": "YOUR_BOT_NAME",
        "TELEGRAM_BOT_API": "https://api.telegram.org/bot",
        "TELEGRAM_BOT_TOKEN": "YOUR_BOT_TOKEN",
        "WEBHOOK_SECRET_TOKEN": "YOUR_SECRET_TOKEN",
        "TELEGRAM_BOT_OWNER_ID": "YOUR_TELEGRAM_ID",
        "TELEGRAM_BOT_WELCOME_TEXT": "Welcome to use my telegram bot!",
        "MESSAGE_RELAY_KV_EXPIRATION_TTL": "604800" // 消息映射关系过期时间，以毫秒(ms)为单位
    },
    "kv_namespaces": [
        {
            "binding": "MESSAGE_RELAY_KV",
            "id": "YOUR_KV_ID"
        },
        {
            "binding": "TELEGRAM_BOT_CONFIG_KV",
            "id": "YOUR_KV_ID"
        }
    ]
}
```

6. Deploy to Cloudflare Workers

```bash
npx wrangler deploy
```

7. Set Telegram WebHook

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" -d "url=<YOUR_WORKERS_URL>/webhook&secret_token=<YOUR_SECRET_TOKEN>"
```
