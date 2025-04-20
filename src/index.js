// src/index.js

import { handleRequest } from './handlers/updateHandler';
import { getConfig } from './env';
import { TimerDO } from './utils/timer_do';

export default {
	async fetch(request, env, ctx) {
		try {
			const url = new URL(request.url);
			const pathname = url.pathname;

			switch (pathname) {
				case '/webhook':
					// 初始化配置
					const config = getConfig(env);
					// 处理请求
					return await handleRequest(request, config, env, ctx);
				case '/':
				case '':
					return new Response('This is working.', {
						status: 200,
						headers: { 'Content-Type': 'text/plain' },
					});

				default:
					return new Response('Not Found', {
						status: 404,
						headers: { 'Content-Type': 'text/plain' },
					});
			}
		} catch (error) {
			console.error('Error processing request:', error);
			const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
			return new Response(`Internal Server Error: ${errorMessage}`, {
				status: 500,
				headers: { 'Content-Type': 'text/plain' },
			});
		}
	},

	// 如果您未来需要使用 TimerDO 的定时任务，可以取消注释此部分
	async scheduled(event, env, ctx) {
		try {
			// 处理定时任务，例如清理过期的 KV 数据等
			console.log(`Cron triggered: ${event.cron}`);
			ctx.waitUntil(doSomeScheduledTask(env));
		} catch (error) {
			console.error('Error processing scheduled:', error);
			const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
			return new Response(`Internal scheduled Error: ${errorMessage}`, {
				status: 500,
				headers: { 'Content-Type': 'text/plain' },
			});
		}
	},
};

export { TimerDO };
