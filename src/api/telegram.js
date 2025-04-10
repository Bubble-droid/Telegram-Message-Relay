// src/api/telegram.js

import { getConfig } from '../env';

export class TelegramBot {
	constructor(env) {
		const config = getConfig(env);
		this.botId = Number(config.telegramBotId);
		this.botName = config.telegramBotName;
		this.botApi = config.telegramBotApi;
		this.botToken = config.telegramBotToken;
		this.apiUrl = `${this.botApi}${this.botToken}`;
		this.secretToken = config.webhookSecretToken;
		this.ownerId = Number(config.telegramBotOwnerId);
		this.fromChatIdKv = config.messageFromChatIdKv;
		this.welcomeText = config.telegramBotWelcomeText;
		this.env = env;
	}

	async handleWebhook(request) {
		if (request.method !== 'POST') {
			return new Response('Method Not Allowed', { status: 405 });
		}

		try {
			console.log('Received Webhook request:');
			console.log(`Method: ${request.method}`);
			const headers = request.headers;
			request.headers.forEach((value, key) => {
				headers[key] = value;
			});
			console.log('Headers:', JSON.stringify(headers, null, 2));

			if (this.secretToken) {
				const requestSecretToken = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
				if (requestSecretToken !== this.secretToken) {
					console.warn('Webhook verification failed: Secret Token is incorrect or missing');
					return new Response('Unauthorized', { status: 444 });
				} else {
					console.log('Webhook verification successful: Secret Token correct, continue processing request');
				}
			} else {
				console.warn('WEBHOOK_SECRET_TOKEN is not configured, skip Webhook verification');
			}

			const update = await request.json();
			console.log('New Telegram Update:', JSON.stringify(update, null, 2));
			await this.handleUpdate(update);
			return new Response('OK', { status: 200 });
		} catch (error) {
			console.error('Error processing webhook:', error);
			return new Response('Internal Server Error', { status: 500 });
		}
	}

	async handleUpdate(update) {
		const ownerId = this.ownerId;
		try {
			if (update.message) {
				const message = update.message;
				const messageId = message?.message_id;
				const fromUserId = message.from?.id;
				const fromChatId = message.chat?.id;

				if (!fromUserId) {
					console.error('User ID is undefined');
					return;
				}

				if (message.entities) {
					const entities = message.entities;
					for (const entity of entities) {
						if (entity.type === 'bot_command') {
							return await this.commandReply(message, fromChatId);
						}
					}
				}

				if (fromUserId !== ownerId) {
					return await this.receiveMessage(message, messageId, fromUserId, fromChatId, ownerId);
				}

				if (fromUserId === ownerId && message.reply_to_message) {
					return await this.replyMessage(message, messageId, fromChatId);
				}
			}
		} catch (error) {
			console.error('Error in handleUpdate:', error);
		}
	}

	async commandReply(message, fromChatId) {
		const replyText = this.welcomeText;
		try {
			const commandText = message?.text;
			if (commandText === '/start') {
				await this.sendMessage(fromChatId, replyText, 'Markdown');
			} else {
				return;
			}
		} catch (error) {}
	}

	async receiveMessage(message, messageId, fromUserId, fromChatId, chatId) {
		try {
			const fromFirstName = message.from?.first_name || '';
			const fromLastName = message.from?.last_name || '';
			const fromNickName = `${fromFirstName} ${fromLastName}`;

			const fromUserName = message.from?.username;
			const fromNameUrl = `https://t.me/${fromUserName}`;
			const fromIdUrl = `tg://user?id=${fromUserId}`;

			let fromUserInfo = `From user: ${fromNickName}`;
			if (!fromUserName) {
				fromUserInfo = `From user: ${fromIdUrl}`;
			} else {
				fromUserInfo = `From user: [${fromNickName}](${fromNameUrl})`;
			}

			// await this.sendMessage(chatId, fromUserInfo, 'Markdown');
			const botForwardMessage = await this.forwardMessage(chatId, fromChatId, messageId);
			const botForwardMessageId = botForwardMessage?.message_id;
			console.log(`botForwardMessageId: ${botForwardMessageId}`);
			await this.fromChatIdKv.put(botForwardMessageId, fromChatId);
		} catch (error) {
			console.error('Error receiveMessage:', error);
		}
	}

	async replyMessage(message, messageId, fromChatId) {
		const replyToMessage = message.reply_to_message;
		try {
			const replyToMessageId = replyToMessage?.message_id;
			const replyToChatId = await this.fromChatIdKv.get(replyToMessageId);
			console.log(`replyToChatId: ${replyToChatId}`);
			await this.copyMessage(replyToChatId, fromChatId, messageId, 'Markdown');
		} catch (error) {
			console.error('Error replyMessage:', error);
		}
	}

	async sendMessage(chatId, text, replyToMessageId = null, parseMode = 'Markdown' | 'HTML') {
		const url = `${this.apiUrl}/sendMessage`;
		try {
			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					chat_id: chatId,
					text: text,
					reply_to_message_id: replyToMessageId,
					parse_mode: parseMode,
				}),
			});

			if (!response.ok) {
				const errorText = await response.text();
				console.error(`Telegram API error: ${response.statusText}`, errorText);
				throw new Error(`Telegram API error: ${response.statusText}\n${errorText}`);
			}
		} catch (error) {
			console.error('Error sending message part:', error);
			throw error;
		}
	}

	async forwardMessage(chatId, fromChatId, messageId) {
		const url = `${this.apiUrl}/forwardMessage`;
		try {
			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					chat_id: chatId,
					from_chat_id: fromChatId,
					message_id: messageId,
				}),
			});

			if (!response.ok) {
				const errorText = await response.text();
				console.error(`Telegram API error: ${response.statusText}`, errorText);
				throw new Error(`Telegram API error: ${response.statusText}\n${errorText}`);
			} else {
				const result = await response.json();
				return { ok: true, message_id: result?.result?.message_id };
			}
		} catch (error) {
			console.error('Error forwarding message part:', error);
			throw error;
		}
	}

	async copyMessage(chatId, fromChatId, messageId, replyToMessageId = null, parseMode = 'Markdown' | 'HTML') {
		const url = `${this.apiUrl}/copyMessage`;
		try {
			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					chat_id: chatId,
					from_chat_id: fromChatId,
					message_id: messageId,
					reply_to_message_id: replyToMessageId,
					parse_mode: parseMode,
				}),
			});

			if (!response.ok) {
				const errorText = await response.text();
				console.error(`Telegram API error: ${response.statusText}`, errorText);
				throw new Error(`Telegram API error: ${response.statusText}\n${errorText}`);
			}
		} catch (error) {
			console.error('Error copying message part:', error);
			throw error;
		}
	}
}

export default TelegramBot;
