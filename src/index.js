// src/index.js

import TelegramBot from './api/telegram';

export default {
	async fetch(request, env) {
		try {
			const bot = new TelegramBot(env);
			const url = new URL(request.url);
			const pathname = url.pathname;

			if (pathname === '/webhook') {
				return await bot.handleWebhook(request);
			}

			if (pathname === '/' || pathname === '') {
				return new Response('OK', {
					status: 200,
					headers: { 'Content-Type': 'text/plain' },
				});
			}

			return new Response('Not Found', {
				status: 404,
				headers: { 'Content-Type': 'text/plain' },
			});
		} catch (error) {
			console.error('Error processing request:', error);
			const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
			return new Response(`Internal Server Error: ${errorMessage}`, {
				status: 500,
				headers: { 'Content-Type': 'text/plain' },
			});
		}
	},
};
