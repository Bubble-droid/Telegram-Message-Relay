# User Instructions

![preview](imgs/preview.png)

#### Clone project to local

```bash
git clone https://github.com/Bubble-droid/Telegram-Message-Relay.git
cd Telegram-Message-Relay
```

#### Install dependencies

```bash
npm install
```

#### Install Wrangler CLI

```bash
npm install -g @cloudflare/wrangler
```

#### Log in to the Cloudflare account

```bash
wrangler login
```

#### Create kV namespace

```bash
wrangler kv namespace create MESSAGE_FROM_CHAT_ID
```

#### Configure wrangler.json


#### Deploy to Cloudflare Workers

```bash
wrangler deploy
```

#### Set Telegram WebHook

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" -d "url=<YOUR_WORKERS_URL>/webhook&secret_token=<YOUR_SECRET_TOKEN>"
```
