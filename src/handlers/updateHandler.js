// src/handlers/updateHandler.js

import { getBlacklist } from '../utils/kvManager';
import { handleCommand } from './commandHandler';
import { handleUserMessage, handleOwnerReply } from './messageHandler';
import { sendMessage } from '../api/telegram-api'; // 用于发送黑名单提示
import { scheduleDeletion } from '../utils/scheduler';

/**
 * 处理传入的 Webhook 请求
 * @param {Request} request - Cloudflare Worker 接收到的请求对象
 * @param {object} config - Bot 配置对象
 * @param {object} env - Cloudflare 环境对象
 * @param {object} ctx - Cloudflare 执行上下文
 * @returns {Promise<Response>} - 返回给 Telegram 的响应
 */
export async function handleRequest(request, config, env, ctx) {
	// 仅接受 POST 请求
	if (request.method !== 'POST') {
		console.log(`收到非 POST 请求: ${request.method}`);
		return new Response('仅支持 POST 方法', { status: 405 });
	}
	console.log(`请求头: ${JSON.stringify(Object.fromEntries(request.headers), null, 2)}`);
	// 验证 Webhook Secret Token
	if (config.webhookSecretToken) {
		const requestSecretToken = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
		if (requestSecretToken !== config.webhookSecretToken) {
			console.warn('Webhook 验证失败: Secret Token 不匹配或缺失');
			// 返回 401 Unauthorized 更符合语义
			return new Response('未授权', { status: 401 });
		}
		console.log('Webhook Secret Token 验证成功');
	} else {
		console.warn('未配置 WEBHOOK_SECRET_TOKEN，跳过 Webhook 验证 (存在安全风险)');
	}

	try {
		const update = await request.json();
		console.log('收到 Telegram 更新:', JSON.stringify(update, null, 2));

		// 使用 ctx.waitUntil 确保异步任务在响应返回后仍能完成
		ctx.waitUntil(processUpdate(update, config, env));

		// 立即返回 OK 给 Telegram，避免超时
		return new Response('OK', { status: 200 });
	} catch (error) {
		console.error('处理 Webhook 请求失败 (解析 JSON 或其他错误):', error);
		return new Response('内部服务器错误', { status: 500 });
	}
}

/**
 * 异步处理 Telegram 更新内容
 * @param {object} update - Telegram 更新对象
 * @param {object} config - Bot 配置对象
 * @param {object} env - Cloudflare 环境对象
 */
async function processUpdate(update, config, env) {
	// 目前只处理消息更新
	if (!update.message) {
		console.log('收到的更新不是消息类型，忽略处理:', Object.keys(update).join(', '));
		return;
	}

	const message = update.message;
	const userId = message.from?.id;
	const chatId = message.chat?.id;
	const messageId = message?.message_id;

	// 检查必要信息是否存在
	if (!userId || !chatId) {
		console.warn('收到的消息缺少 user ID 或 chat ID，忽略处理:', JSON.stringify(message));
		return;
	}

	// --- 黑名单检测 (最高优先级) ---
	try {
		const blacklist = await getBlacklist(env.TELEGRAM_BOT_CONFIG_KV);
		if (blacklist.includes(userId)) {
			console.log(`用户 ${userId} 在黑名单中，已阻止消息。`);
			await scheduleDeletion(env, config.apiUrl, chatId, messageId, 10 * 1000);
			// 可选：可以给用户一个静默的提示，或者完全不响应
			// 注意：频繁给黑名单用户发消息可能导致 Bot 被 Telegram 限制
			const sendToOwner = await sendMessage(config.apiUrl, chatId, '🚫 **未授权！**');
			const botMessageIdToOwner = sendToOwner.message_id;
			await scheduleDeletion(env, config.apiUrl, chatId, botMessageIdToOwner, 10 * 1000);
			return; // 直接返回，不处理后续逻辑
		}
	} catch (error) {
		console.error('检查黑名单时出错:', error);
		// 即使检查黑名单出错，也应该继续处理消息，避免服务中断
	}
	// --- 黑名单检测结束 ---

	try {
		// 判断消息类型并分发给相应的处理器

		// 1. 是否是命令?
		if (message.entities?.some((entity) => entity.type === 'bot_command')) {
			console.log(`检测到命令消息，由 commandHandler 处理`);
			await handleCommand(message, config, env);
		}
		// 2. 是否是所有者的回复?
		else if (userId === config.ownerId && message.reply_to_message) {
			// 确保回复的是 Bot 发送的消息
			if (message.reply_to_message.from?.id === config.botId) {
				console.log(`检测到所有者的回复消息，由 messageHandler.handleOwnerReply 处理`);
				await handleOwnerReply(message, config, env);
			} else {
				console.log(`所有者回复了非 Bot 的消息，按普通消息处理（或忽略）`);
				// 可以选择忽略，或者当作普通消息发送给自己（如果需要记录）
				// await handleUserMessage(message, config, env); // 如果需要记录所有者发的非指令/非回复消息
			}
		}
		// 3. 是否是普通用户的消息 (或其他需要转发给所有者的消息)?
		else if (userId !== config.ownerId) {
			console.log(`检测到普通用户的消息，由 messageHandler.handleUserMessage 处理`);
			await handleUserMessage(message, config, env);
		}
		// 4. 其他情况 (例如所有者发送的非命令、非回复消息)
		else {
			console.log(`收到来自所有者的非命令/非回复消息，当前配置下忽略处理。`);
			// 如果需要，可以在这里添加逻辑，例如记录日志或给自己发提醒
		}
	} catch (error) {
		console.error('处理消息更新时发生未捕获的错误:', error);
		// 可以在这里添加全局错误通知逻辑，例如通知管理员
		// try {
		//     await sendMessage(config.apiUrl, config.ownerId, `🚨 处理消息时发生严重错误: ${error.message}`);
		// } catch (notifyError) {
		//     console.error('发送全局错误通知失败:', notifyError);
		// }
	}
}
