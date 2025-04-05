// src/env.js

export const getConfig = (env) => {
	return {
		telegramBotId: env.TELEGRAM_BOT_ID,
		telegramBotName: env.TELEGRAM_BOT_NAME,
		telegramBotApi: env.TELEGRAM_BOT_API,
		telegramBotToken: env.TELEGRAM_BOT_TOKEN,
		webhookSecretToken: env.WEBHOOK_SECRET_TOKEN,
		telegramBotOwnerId: env.TELEGRAM_BOT_OWNER_ID,
		messageFromChatIdKv: env.MESSAGE_FROM_CHAT_ID,
		telegramBotWelcomeText: env.TELEGRAM_BOT_WELCOME_TEXT,
	};
};
