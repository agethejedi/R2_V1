import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { BotDurableObject } from './bot-do';
import { authRequired, issueToken, validAdmin } from './auth';
import {
  getDecisions,
  getOrders,
  getPositions,
  getSettings
} from './db';
import type { Env } from './types';

const app = new Hono<{ Bindings: Env }>();

app.use(
  '*',
  cors({
    origin: '*',
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PATCH', 'OPTIONS']
  })
);

// Important: explicitly answer browser preflight requests
app.options('*', (c) => {
  return c.text('', 204);
});

function botStub(env: Env) {
  const id = env.BOT_DO.idFromName('primary-bot');
  return env.BOT_DO.get(id);
}

async function proxyToBot(
  env: Env,
  url: string,
  init?: RequestInit
): Promise<Response> {
  const res = await botStub(env).fetch(url, init);
  return new Response(res.body, res);
}

app.get('/health', (c) => {
  return c.json({ ok: true, service: 'worker' });
});

app.post('/auth/login', async (c) => {
  const body = await c.req.json<{ username: string; password: string }>();

  if (!validAdmin(c, body.username, body.password)) {
    return c.json({ error: 'invalid_credentials' }, 401);
  }

  return c.json({
    token: await issueToken(c.env, body.username)
  });
});

app.get('/api/status', authRequired, async (c) => {
  return proxyToBot(c.env, 'https://bot/status');
});

app.post('/api/tick', authRequired, async (c) => {
  return proxyToBot(c.env, 'https://bot/tick', {
    method: 'POST'
  });
});

app.get('/api/settings', authRequired, async (c) => {
  return c.json(await getSettings(c.env));
});

app.patch('/api/settings', authRequired, async (c) => {
  const body = await c.req.json<Record<string, unknown>>();

  return proxyToBot(c.env, 'https://bot/settings', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json'
    }
  });
});

app.get('/api/orders', authRequired, async (c) => {
  return c.json(await getOrders(c.env));
});

app.get('/api/positions', authRequired, async (c) => {
  return c.json(await getPositions(c.env));
});

app.get('/api/decisions', authRequired, async (c) => {
  return c.json(await getDecisions(c.env));
});

app.post('/api/trade', authRequired, async (c) => {
  const body = await c.req.json<{
    side: 'BUY' | 'SELL';
    notionalUsd: number;
  }>();

  return proxyToBot(c.env, 'https://bot/trade', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json'
    }
  });
});

app.post('/api/close-position', authRequired, async (c) => {
  return proxyToBot(c.env, 'https://bot/close-position', {
    method: 'POST'
  });
});

app.post('/api/reset-risk', authRequired, async (c) => {
  return proxyToBot(c.env, 'https://bot/reset-risk', {
    method: 'POST'
  });
});

app.get('/api/ws', authRequired, async (c) => {
  return botStub(c.env).fetch('https://bot/ws', c.req.raw);
});

export { BotDurableObject };
export default app;


