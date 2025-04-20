// src/utils/commands.js

import { setMyCommands, setChatMenuButton } from '../api/telegram-api';

// 定义 Bot 命令
export const botCommands = [
	{ command: 'start', description: '🚀 显示欢迎信息和帮助' },
	{ command: 'ban', description: '🚫 [管理员] 封禁用户 (用法: /ban <用户ID>)' },
	{ command: 'unban', description: '✅ [管理员] 解封用户 (用法: /unban <用户ID>)' },
	// 您可以根据需要添加更多命令
	// { command: 'help', description: '❓ 显示此帮助信息' },
];

/**
 * 为指定用户设置 Bot 命令菜单和对话菜单按钮
 * @param {string} apiUrl - Telegram API URL 前缀
 * @param {number|string} chatId - 目标用户/聊天的 ID
 */
export async function setupOwnerCommands(apiUrl, chatId) {
	try {
		// 1. 设置命令列表
		const commandsToSet = botCommands; // 可以根据需要过滤非管理员命令
		const scope = { type: 'chat', chat_id: chatId };
		const commandsSet = await setMyCommands(apiUrl, commandsToSet, scope);
		if (commandsSet) {
			console.log(`成功为用户 ${chatId} 设置命令菜单`);
		} else {
			console.warn(`为用户 ${chatId} 设置命令菜单失败`);
		}

		// 2. 设置对话菜单按钮为显示命令
		const menuButton = { type: 'commands' };
		const menuButtonSet = await setChatMenuButton(apiUrl, chatId, menuButton);
		if (menuButtonSet) {
			console.log(`成功为用户 ${chatId} 设置对话菜单按钮`);
		} else {
			console.warn(`为用户 ${chatId} 设置对话菜单按钮失败`);
		}
	} catch (error) {
		console.error(`为用户 ${chatId} 设置命令时发生错误:`, error);
	}
}
