// src/api/telegram-api.js

import { formatTextHtml } from '../utils/textUtils';

/**
 * 封装通用的 Telegram API 请求方法
 * @param {string} apiUrl - 包含 Bot Token 的完整 API URL 前缀
 * @param {string} methodName - Telegram Bot API 方法名 (例如 'sendMessage', 'copyMessage')
 * @param {object} params - 发送给 API 的参数对象
 * @returns {Promise<object>} - 返回 API 响应的 JSON 对象
 * @throws {Error} - 如果 API 请求失败或返回错误，则抛出错误
 */
async function callTelegramApi(apiUrl, methodName, params) {
	const url = `${apiUrl}/${methodName}`;
	console.log(`调用 Telegram API: ${methodName}`, JSON.stringify(params)); // 记录调用信息
	try {
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(params),
		});

		const responseData = await response.json();

		if (!response.ok || !responseData.ok) {
			console.error(`Telegram API 错误 (${methodName}): ${response.status} ${response.statusText}`, JSON.stringify(responseData));
			throw new Error(`Telegram API 错误 (${methodName}): ${responseData.description || response.statusText}`);
		}

		console.log(`Telegram API 成功 (${methodName}):`, JSON.stringify(responseData.result));
		return responseData.result; // 返回 result 部分
	} catch (error) {
		console.error(`调用 Telegram API 时发生网络或解析错误 (${methodName}):`, error);
		// 可以根据需要进行更细致的错误处理，例如重试
		throw error; // 将错误继续向上抛出
	}
}

/**
 * 发送文本消息
 * @param {string} apiUrl - API URL 前缀
 * @param {number|string} chatId - 目标聊天 ID
 * @param {string} text - 消息文本
 * @param {number} [replyToMessageId=null] - 回复的消息 ID
 * @param {string} [parseMode='HTML'] - 解析模式 (推荐 HTML 或 HTML)
 * @returns {Promise<object>} - 发送的消息对象
 */
export async function sendMessage(apiUrl, chatId, text, replyToMessageId = null, parseMode = 'HTML') {
	return callTelegramApi(apiUrl, 'sendMessage', {
		chat_id: chatId,
		text: formatTextHtml(text),
		reply_to_message_id: replyToMessageId,
		parse_mode: parseMode,
		link_preview_options: { is_disabled: true }, // 默认禁用链接预览
	});
}

/**
 * 复制消息
 * @param {string} apiUrl - API URL 前缀
 * @param {number|string} chatId - 目标聊天 ID
 * @param {number|string} fromChatId - 来源聊天 ID
 * @param {number} messageId - 要复制的消息 ID
 * @param {number} [replyToMessageId=null] - 回复的消息 ID (用于精准回复)
 * @param {string} [caption=null] - 新的标题 (如果需要修改)
 * @param {string} [parseMode='HTML'] - 标题的解析模式
 * @returns {Promise<object>} - 复制后的消息对象 (只包含 message_id)
 */
export async function copyMessage(apiUrl, chatId, fromChatId, messageId, replyToMessageId = null, caption = null, parseMode = 'HTML') {
	const params = {
		chat_id: chatId,
		from_chat_id: fromChatId,
		message_id: messageId,
	};
	if (replyToMessageId) {
		params.reply_to_message_id = replyToMessageId;
	}
	if (caption !== null) {
		// 允许设置空字符串标题
		params.caption = caption;
		params.parse_mode = parseMode;
	}
	// 注意：copyMessage 返回的是 MessageId 对象，不是完整的 Message 对象
	// { "ok": true, "result": { "message_id": 123 } }
	const result = await callTelegramApi(apiUrl, 'copyMessage', params);
	// 为了统一返回格式，我们返回包含 message_id 的对象
	return { message_id: result.message_id };
}

/**
 * 编辑消息文本
 * @param {string} apiUrl - API URL 前缀
 * @param {number|string} chatId - 聊天 ID
 * @param {number} messageId - 要编辑的消息 ID
 * @param {string} text - 新的文本内容
 * @param {string} [parseMode='HTML'] - 解析模式
 * @returns {Promise<object>} - 编辑后的消息对象或 true
 */
export async function editMessageText(apiUrl, chatId, messageId, text, parseMode = 'HTML') {
	return callTelegramApi(apiUrl, 'editMessageText', {
		chat_id: chatId,
		message_id: messageId,
		text: formatTextHtml(text),
		parse_mode: parseMode,
		link_preview_options: { is_disabled: true },
	});
}

/**
 * 编辑消息标题
 * @param {string} apiUrl - API URL 前缀
 * @param {number|string} chatId - 聊天 ID
 * @param {number} messageId - 要编辑的消息 ID
 * @param {string} caption - 新的标题内容
 * @param {string} [parseMode='HTML'] - 解析模式
 * @returns {Promise<object>} - 编辑后的消息对象或 true
 */
export async function editMessageCaption(apiUrl, chatId, messageId, caption, parseMode = 'HTML') {
	return callTelegramApi(apiUrl, 'editMessageCaption', {
		chat_id: chatId,
		message_id: messageId,
		caption: formatTextHtml(caption),
		parse_mode: parseMode,
		show_caption_above_media: true, // 这个参数似乎在 Bot API 文档中不推荐直接使用，通常由客户端处理
	});
}

/**
 * 设置 Bot 命令菜单
 * @param {string} apiUrl - API URL 前缀
 * @param {Array<object>} commands - 命令列表 [{ command: 'start', description: '...' }, ...]
 * @param {object} scope - 命令生效范围 (例如 { type: 'chat', chat_id: chatId })
 * @returns {Promise<boolean>} - 是否设置成功
 */
export async function setMyCommands(apiUrl, commands, scope) {
	const result = await callTelegramApi(apiUrl, 'setMyCommands', {
		commands: commands,
		scope: scope,
	});
	return result === true; // setMyCommands 成功时返回 true
}

/**
 * 设置对话菜单按钮
 * @param {string} apiUrl - API URL 前缀
 * @param {number|string} chatId - 目标聊天 ID
 * @param {object} menuButton - 菜单按钮配置 (例如 { type: 'commands' })
 * @returns {Promise<boolean>} - 是否设置成功
 */
export async function setChatMenuButton(apiUrl, chatId, menuButton) {
	const result = await callTelegramApi(apiUrl, 'setChatMenuButton', {
		chat_id: chatId,
		menu_button: menuButton,
	});
	return result === true; // setChatMenuButton 成功时返回 true
}

// 您可以根据需要添加其他 API 方法的封装，例如 deleteMessage
/**
 * 删除消息
 * @param {string} apiUrl - API URL 前缀
 * @param {number|string} chatId - 聊天 ID
 * @param {number} messageId - 要删除的消息 ID
 * @returns {Promise<boolean>} - 是否删除成功
 */
export async function deleteMessage(apiUrl, chatId, messageId) {
	const result = await callTelegramApi(apiUrl, 'deleteMessage', {
		chat_id: chatId,
		message_id: messageId,
	});
	return result === true; // deleteMessage 成功时返回 true
}
