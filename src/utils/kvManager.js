// src/utils/kvManager.js

const BLACKLIST_KEY = 'black_list'; // 黑名单在 KV 中存储的键名

/**
 * 获取黑名单列表
 * @param {object} kvNamespace - TELEGRAM_BOT_CONFIG_KV 的实例
 * @returns {Promise<Array<number>>} - 用户 ID 组成的黑名单数组，如果 KV 中没有则返回空数组
 */
export async function getBlacklist(kvNamespace) {
	try {
		const blacklistJson = await kvNamespace.get(BLACKLIST_KEY);
		return blacklistJson ? JSON.parse(blacklistJson) : [];
	} catch (error) {
		console.error('从 KV 获取黑名单失败:', error);
		return []; // 出错时返回空列表，避免阻塞
	}
}

/**
 * 将用户添加到黑名单
 * @param {object} kvNamespace - TELEGRAM_BOT_CONFIG_KV 的实例
 * @param {number} userId - 要加入黑名单的用户 ID
 * @returns {Promise<boolean>} - 操作是否成功
 */
export async function addUserToBlacklist(kvNamespace, userId) {
	try {
		const currentBlacklist = await getBlacklist(kvNamespace);
		if (!currentBlacklist.includes(userId)) {
			const updatedBlacklist = [...currentBlacklist, userId];
			await kvNamespace.put(BLACKLIST_KEY, JSON.stringify(updatedBlacklist));
			console.log(`用户 ${userId} 已添加到黑名单`);
			return true;
		}
		console.log(`用户 ${userId} 已在黑名单中`);
		return true; // 已经在黑名单中也视为成功
	} catch (error) {
		console.error(`将用户 ${userId} 添加到黑名单失败:`, error);
		return false;
	}
}

/**
 * 将用户从黑名单移除
 * @param {object} kvNamespace - TELEGRAM_BOT_CONFIG_KV 的实例
 * @param {number} userId - 要移出黑名单的用户 ID
 * @returns {Promise<boolean>} - 操作是否成功
 */
export async function removeUserFromBlacklist(kvNamespace, userId) {
	try {
		const currentBlacklist = await getBlacklist(kvNamespace);
		if (currentBlacklist.includes(userId)) {
			const updatedBlacklist = currentBlacklist.filter((id) => id !== userId);
			await kvNamespace.put(BLACKLIST_KEY, JSON.stringify(updatedBlacklist));
			console.log(`用户 ${userId} 已从黑名单移除`);
			return true;
		}
		console.log(`用户 ${userId} 不在黑名单中`);
		return true; // 不在黑名单中也视为成功
	} catch (error) {
		console.error(`将用户 ${userId} 从黑名单移除失败:`, error);
		return false;
	}
}

/**
 * 存储消息映射关系 (Bot 发送的消息 ID -> 原始消息来源)
 * @param {object} kvNamespace - MESSAGE_RELAY_KV 的实例
 * @param {number} botMessageId - Bot 发送的消息 ID (作为 Key)
 * @param {number|string} fromChatId - 原始消息的聊天 ID
 * @param {number} fromMessageId - 原始消息的消息 ID
 * @returns {Promise<void>}
 */
export async function storeMessageMapping(kvExpirationTtl, kvNamespace, botMessageId, fromChatId, fromMessageId) {
	const key = String(botMessageId); // KV 的 key 必须是字符串
	const value = `${fromChatId}_${fromMessageId}`;
	try {
		await kvNamespace.put(key, value, { expirationTtl: kvExpirationTtl });
		console.log(`存储消息映射: Key=${key}, Value=${value}, TTL=${kvExpirationTtl}s`);
	} catch (error) {
		console.error(`存储消息映射失败 (Key: ${key}):`, error);
	}
}

/**
 * 获取原始消息来源
 * @param {object} kvNamespace - MESSAGE_RELAY_KV 的实例
 * @param {number} botMessageId - Bot 发送的消息 ID (作为 Key)
 * @returns {Promise<{fromChatId: number|string, fromMessageId: number}|null>} - 包含原始聊天 ID 和消息 ID 的对象，或 null (如果未找到)
 */
export async function getOriginalMessageSource(kvNamespace, botMessageId) {
	const key = String(botMessageId);
	try {
		const value = await kvNamespace.get(key);
		if (value) {
			const parts = value.split('_');
			if (parts.length === 2) {
				// 尝试将 chat_id 和 message_id 解析为数字，如果 chat_id 不能解析为数字（例如频道用户名），则保持字符串
				const chatIdPart = parts[0];
				const messageIdPart = parts[1];
				const fromChatId = /^\d+$/.test(chatIdPart) ? Number(chatIdPart) : chatIdPart;
				const fromMessageId = Number(messageIdPart);
				if (!isNaN(fromMessageId)) {
					console.log(`获取到消息映射: Key=${key}, Value=${value}`);
					return { fromChatId, fromMessageId };
				}
			}
			console.warn(`KV 中找到无效的消息映射格式 (Key: ${key}, Value: ${value})`);
		} else {
			console.log(`未找到消息映射 (Key: ${key})`);
		}
		return null;
	} catch (error) {
		console.error(`获取原始消息来源失败 (Key: ${key}):`, error);
		return null;
	}
}
