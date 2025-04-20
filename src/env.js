// src/env.js

/**
 * 从环境变量中获取并整理配置信息
 * @param {object} env - Cloudflare Worker 的环境变量对象
 * @returns {object} 包含所有配置项的对象
 */
export const getConfig = (env) => {
	// 验证必要的环境变量是否存在
	const requiredVars = [
		'TELEGRAM_BOT_TOKEN',
		'TELEGRAM_BOT_OWNER_ID',
		'MESSAGE_RELAY_KV', // 确认绑定名称与 wrangler.jsonc 一致
		'TELEGRAM_BOT_CONFIG_KV', // 确认绑定名称与 wrangler.jsonc 一致
	];
	for (const varName of requiredVars) {
		if (!env[varName]) {
			throw new Error(`缺少必要的环境变量: ${varName}`);
		}
	}

	return {
		botId: env.TELEGRAM_BOT_ID ? Number(env.TELEGRAM_BOT_ID) : undefined, // 可选
		botName: env.TELEGRAM_BOT_NAME || '', // 可选
		botApi: env.TELEGRAM_BOT_API || 'https://api.telegram.org/bot', // 可选，提供默认值
		botToken: env.TELEGRAM_BOT_TOKEN,
		apiUrl: `${env.TELEGRAM_BOT_API || 'https://api.telegram.org/bot'}${env.TELEGRAM_BOT_TOKEN}`,
		webhookSecretToken: env.WEBHOOK_SECRET_TOKEN || '', // 可选
		ownerId: Number(env.TELEGRAM_BOT_OWNER_ID),
		messageRelayKv: env.MESSAGE_RELAY_KV, // 确认绑定名称
		botConfigKv: env.TELEGRAM_BOT_CONFIG_KV, // 确认绑定名称
		welcomeText: env.TELEGRAM_BOT_WELCOME_TEXT || '欢迎使用！', // 可选，提供默认值
		kvExpirationTtl: Number(env.MESSAGE_RELAY_KV_EXPIRATION_TTL || '259200'),
	};
};
