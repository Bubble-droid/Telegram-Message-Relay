// src/handlers/commandHandler.js

import { sendMessage } from '../api/telegram-api';
import { addUserToBlacklist, removeUserFromBlacklist } from '../utils/kvManager';
import { botCommands, setupOwnerCommands } from '../utils/commands';

/**
 * 处理传入的命令
 * @param {object} message - Telegram 消息对象
 * @param {object} config - Bot 配置对象
 * @param {object} env - Cloudflare 环境对象
 * @returns {Promise<Response>} - 返回给 Telegram 的响应
 */
export async function handleCommand(message, config, env) {
	const chatId = message.chat.id;
	const userId = message.from.id;
	const text = message.text || '';
	const ownerId = config.ownerId;
	const apiUrl = config.apiUrl;
	const botConfigKv = env.TELEGRAM_BOT_CONFIG_KV;

	// 解析命令和参数
	const commandMatch = text.match(/^\/(\w+)(?:\s+(.*))?/);
	if (!commandMatch) {
		console.warn('无法解析命令:', text);
		// 可以选择回复一个提示消息，或者直接忽略
		// await sendMessage(apiUrl, chatId, '无法识别的命令格式。');
		return new Response('OK'); // 告诉 Telegram 已收到，但未处理
	}

	const command = commandMatch[1].toLowerCase();
	const argsText = commandMatch[2] ? commandMatch[2].trim() : ''; // 命令参数部分

	console.log(`处理命令: /${command}, 参数: "${argsText}", 来自用户: ${userId}`);

	try {
		switch (command) {
			case 'start':
				// 对所有人发送欢迎消息
				await sendMessage(apiUrl, chatId, config.welcomeText, null, 'HTML');
				// 如果是所有者，额外设置命令菜单
				if (userId === ownerId) {
					await setupOwnerCommands(apiUrl, chatId);
				}
				break;

			case 'ban':
				// 仅限所有者使用
				if (userId !== ownerId) {
					await sendMessage(apiUrl, chatId, '抱歉，您没有权限执行此命令。');
					break;
				}
				// 验证参数
				const userIdToBan = parseInt(argsText, 10);
				if (isNaN(userIdToBan)) {
					await sendMessage(apiUrl, chatId, '命令格式错误。\n用法: `/ban <用户ID>`\n`<用户ID>` 必须是纯数字。', null, 'HTML');
					break;
				}
				// 执行封禁
				const banSuccess = await addUserToBlacklist(botConfigKv, userIdToBan);
				if (banSuccess) {
					await sendMessage(apiUrl, chatId, `✅ 用户 \`${userIdToBan}\` 已成功添加到黑名单。`, null, 'HTML');
				} else {
					await sendMessage(apiUrl, chatId, `❌ 将用户 \`${userIdToBan}\` 添加到黑名单时出错，请检查日志。`, null, 'HTML');
				}
				break;

			case 'unban':
				// 仅限所有者使用
				if (userId !== ownerId) {
					await sendMessage(apiUrl, chatId, '抱歉，您没有权限执行此命令。');
					break;
				}
				// 验证参数
				const userIdToUnban = parseInt(argsText, 10);
				if (isNaN(userIdToUnban)) {
					await sendMessage(apiUrl, chatId, '命令格式错误。\n用法: `/unban <用户ID>`\n`<用户ID>` 必须是纯数字。', null, 'HTML');
					break;
				}
				// 执行解封
				const unbanSuccess = await removeUserFromBlacklist(botConfigKv, userIdToUnban);
				if (unbanSuccess) {
					await sendMessage(apiUrl, chatId, `✅ 用户 \`${userIdToUnban}\` 已成功从黑名单移除。`, null, 'HTML');
				} else {
					await sendMessage(apiUrl, chatId, `❌ 将用户 \`${userIdToUnban}\` 从黑名单移除时出错，请检查日志。`, null, 'HTML');
				}
				break;

			// 可以添加 /help 命令
			// case 'help':
			//     const helpText = botCommands
			//         .map(cmd => `/${cmd.command} - ${cmd.description}`)
			//         .join('\n');
			//     await sendMessage(apiUrl, chatId, `可用命令:\n${helpText}`);
			//     break;

			default:
				// 未知命令
				await sendMessage(apiUrl, chatId, `抱歉，未知的命令: /${command}`);
				break;
		}
	} catch (error) {
		console.error(`处理命令 /${command} 时出错:`, error);
		// 向用户发送通用错误消息
		try {
			await sendMessage(apiUrl, chatId, '处理您的命令时发生内部错误，请稍后再试。');
		} catch (sendError) {
			console.error('发送错误通知失败:', sendError);
		}
	}

	return new Response('OK'); // 告诉 Telegram 已成功处理
}
