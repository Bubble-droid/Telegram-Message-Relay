// src/handlers/messageHandler.js

import { copyMessage, editMessageCaption, editMessageText, sendMessage } from '../api/telegram-api';
import { storeMessageMapping, getOriginalMessageSource } from '../utils/kvManager';

/**
 * 处理来自普通用户的消息 (转发给所有者)
 * @param {object} message - Telegram 消息对象
 * @param {object} config - Bot 配置对象
 * @param {object} env - Cloudflare 环境对象
 * @returns {Promise<void>}
 */
export async function handleUserMessage(message, config, env) {
	const fromUserId = message.from.id;
	const fromChatId = message.chat.id;
	const fromMessageId = message.message_id;
	const ownerId = config.ownerId;
	const apiUrl = config.apiUrl;
	const messageRelayKv = env.MESSAGE_RELAY_KV;

	console.log(`收到来自用户 ${fromUserId} (Chat: ${fromChatId}) 的消息 ${fromMessageId}`);

	let replyToOwnerMessageId = null;

	// 检查用户是否回复了 Bot 的某条消息
	if (message.reply_to_message && message.reply_to_message.from.id === config.botId) {
		const botRepliedMessageId = message.reply_to_message.message_id;
		console.log(`用户 ${fromUserId} 回复了 Bot 的消息 ${botRepliedMessageId}`);
		// 尝试从 KV 查找这条 Bot 消息对应的原始所有者消息
		const originalSource = await getOriginalMessageSource(messageRelayKv, botRepliedMessageId);
		if (originalSource && originalSource.fromChatId === ownerId) {
			replyToOwnerMessageId = originalSource.fromMessageId;
			console.log(`找到对应的所有者原始消息 ${replyToOwnerMessageId}，将精准回复`);
		} else {
			console.log(`未找到 Bot 消息 ${botRepliedMessageId} 对应的所有者原始消息，将仅转发`);
		}
	}

	try {
		// 1. 使用 copyMessage 将用户消息复制给所有者，如果需要，带上回复信息
		const copiedToOwner = await copyMessage(apiUrl, ownerId, fromChatId, fromMessageId, replyToOwnerMessageId);
		const botMessageIdToOwner = copiedToOwner.message_id;

		if (!botMessageIdToOwner) {
			console.error('复制消息给所有者失败，未获取到 message_id');
			// 可以考虑通知用户转发失败
			// await sendMessage(apiUrl, fromChatId, "抱歉，转发您的消息时遇到问题，请稍后再试。");
			return;
		}
		console.log(`成功将用户消息 ${fromMessageId} 复制给所有者，新消息 ID: ${botMessageIdToOwner}`);

		// 2. 存储映射关系: Bot 发给所有者的消息 ID -> 用户原始消息 ID
		await storeMessageMapping(config.kvExpirationTtl, messageRelayKv, botMessageIdToOwner, fromChatId, fromMessageId);

		// 3. (可选) 编辑刚发送给所有者的消息，添加用户信息
		//    为了模拟真实对话，可以不加这个信息，或者只在非文本消息时添加
		const fromFirstName = message.from?.first_name || '';
		const fromLastName = message.from?.last_name || '';
		let fromFullName = `${fromFirstName} ${fromLastName}`.trim();
		const fromUsername = message.from?.username;
		const fromUserIdLink = `tg://user?id=${fromUserId}`;

		let userInfoText = '';
		if (fromUsername) {
			userInfoText = `来自: [${fromFullName || `@${fromUsername}`}](https://t.me/${fromUsername}) (ID: \`${fromUserId}\`)`;
		} else {
			userInfoText = `来自: ${fromFullName || '未知用户'} (ID: \`${fromUserId}\`)`;
			userInfoText += `\n ${fromUserIdLink} `;
		}
		userInfoText += `\n————————————`;

		// 只有在原始消息不是纯文本或者需要明确展示来源时才编辑添加用户信息
		// 对于纯文本消息，为了沉浸式体验，可以考虑不编辑
		if (message.text) {
			// 如果希望在文本消息前也加上来源信息，取消下面的注释
			const originalText = message.text;
			const fullText = `${userInfoText}\n${originalText}`;
			await editMessageText(apiUrl, ownerId, botMessageIdToOwner, fullText, 'HTML');
			console.log(`已编辑所有者收到的文本消息 ${botMessageIdToOwner}，添加了用户信息`);
		} else if (message.sticker) {
			await sendMessage(apiUrl, ownerId, userInfoText);
			console.log(`表情消息直接发送用户信息`);
		} else if (message.caption) {
			const originalCaption = message.caption;
			const fullCaption = `${userInfoText}\n${originalCaption}`;
			await editMessageCaption(apiUrl, ownerId, botMessageIdToOwner, fullCaption, 'HTML');
			console.log(`已编辑所有者收到的带标题消息 ${botMessageIdToOwner}，添加了用户信息`);
		} else {
			// 对于没有文本和标题的消息（如贴纸、图片、文件等），添加用户信息作为标题
			await editMessageCaption(apiUrl, ownerId, botMessageIdToOwner, userInfoText, 'HTML');
			console.log(`已编辑所有者收到的无标题消息 ${botMessageIdToOwner}，添加了用户信息作为标题`);
		}
	} catch (error) {
		console.error(`处理用户 ${fromUserId} 的消息 ${fromMessageId} 时出错:`, error);
		// 可以考虑通知用户转发失败
		try {
			await sendMessage(apiUrl, fromChatId, '抱歉，转发您的消息时遇到问题，请稍后再试。');
		} catch (sendError) {
			console.error('发送错误通知给用户失败:', sendError);
		}
	}
}

/**
 * 处理来自所有者的回复消息 (转发给原始用户)
 * @param {object} message - Telegram 消息对象 (所有者的回复)
 * @param {object} config - Bot 配置对象
 * @param {object} env - Cloudflare 环境对象
 * @returns {Promise<void>}
 */
export async function handleOwnerReply(message, config, env) {
	const ownerId = config.ownerId; // 确认是所有者发的
	const ownerMessageId = message.message_id;
	const apiUrl = config.apiUrl;
	const messageRelayKv = env.MESSAGE_RELAY_KV;

	// 确认是回复消息
	if (!message.reply_to_message) {
		console.log('所有者发送了非回复消息，忽略处理。');
		// 可以选择提示所有者需要回复才能转发
		// await sendMessage(apiUrl, ownerId, "请回复您想转发的消息。");
		return;
	}

	const repliedToBotMessageId = message.reply_to_message.message_id;
	console.log(`所有者 ${ownerId} 回复了 Bot 的消息 ${repliedToBotMessageId}`);

	// 1. 从 KV 获取原始用户信息
	const originalSource = await getOriginalMessageSource(messageRelayKv, repliedToBotMessageId);

	if (!originalSource) {
		console.warn(`未找到 Bot 消息 ${repliedToBotMessageId} 对应的原始用户信息，无法转发。`);
		await sendMessage(
			apiUrl,
			ownerId,
			`⚠️ 无法转发回复：找不到原始消息来源。\n可能原因：\n- 原始消息已超过 ${config.kvExpirationTtl / 3600 / 24} 天有效期。\n- 消息记录已被清理。\n- 系统内部错误。`,
			message.message_id,
		);
		return;
	}

	const targetChatId = originalSource.fromChatId;
	const targetMessageId = originalSource.fromMessageId; // 这是原始用户的消息 ID

	console.log(`准备将所有者的回复 ${ownerMessageId} 转发给用户 ${targetChatId}，回复其原始消息 ${targetMessageId}`);

	try {
		// 2. 使用 copyMessage 将所有者的回复复制给原始用户，并精准回复用户的原始消息
		const copiedToUser = await copyMessage(apiUrl, targetChatId, ownerId, ownerMessageId, targetMessageId);
		const botMessageIdToUser = copiedToUser.message_id;

		if (!botMessageIdToUser) {
			console.error(`复制消息给用户 ${targetChatId} 失败，未获取到 message_id`);
			await sendMessage(apiUrl, ownerId, `❌ 转发回复给用户 \`${targetChatId}\` 失败，请检查日志。`, message.message_id, 'HTML');
			return;
		}
		console.log(
			`成功将所有者的回复 ${ownerMessageId} 复制给用户 ${targetChatId} (回复消息 ${targetMessageId})，新消息 ID: ${botMessageIdToUser}`,
		);

		// 3. 存储映射关系: Bot 发给用户的消息 ID -> 所有者回复的消息 ID
		//    这样用户回复这条消息时，可以找到所有者的对应回复
		await storeMessageMapping(config.kvExpirationTtl, messageRelayKv, botMessageIdToUser, ownerId, ownerMessageId);

		// 转发成功，无需额外通知所有者
	} catch (error) {
		console.error(`处理所有者回复消息 ${ownerMessageId} 时出错:`, error);
		// 通知所有者转发失败
		try {
			await sendMessage(
				apiUrl,
				ownerId,
				`❌ 转发回复给用户 \`${targetChatId}\` 时发生错误: ${error.message || '未知错误'}`,
				message.message_id,
				'HTML',
			);
		} catch (sendError) {
			console.error('发送错误通知给所有者失败:', sendError);
		}
	}
}
