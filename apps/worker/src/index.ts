import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { BotDurableObject } from './bot-do';
import { authRequired, issueToken, validAdmin } from './auth';
import { getDecisions, getOrders, getPositions, getSettings } from './db';
import type { Env } from './types';

const app = new Hono<{ Bindings: Env }>();
app.use('*', cors({ origin: '*', allowHeaders: ['Content-Type', 'Authorization'], allowMethods: ['GET', 'POST', 'PATCH'] }));

function botStub(env: Env) {
  const id = env.BOT_DO.idFromName('primary-bot');
  return env.BOT_DO.get(id);
}

app.get('/health', (c) => c.json({ ok: true, service: 'worker' }));

app.post('/auth/login', async (c) => {
  const body = await c.req.json<{ username: string; password: string }>();
  if (!validAdmin(c, body.username, body.password)) return c.json({ error: 'invalid_credentials' }, 401);
  return c.json({ token: await issueToken(c.env, body.username) });
});

app.get('/api/status', authRequired, async (c) => {
  const res = await botStub(c.env).fetch('https://bot/status');
  return new Response(res.body, res);
});

app.post('/api/tick', authRequired, async (c) => {
  const res = await botStub(c.env).fetch('https://bot/tick');
  return new Response(res.body, res);
});

app.get('/api/settings', authRequired, async (c) => c.json(await getSettings(c.env)));
app.get('/api/orders', authRequired, async (c) => c.json(await getOrders(c.env)));
app.get('/api/positions', authRequired, async (c) => c.json(await getPositions(c.env)));
app.get('/api/decisions', authRequired, async (c) => c.json(await getDecisions(c.env)));

app.post('/api/trade', authRequired, async (c) => {
  const body = await c.req.json<{ side: 'BUY' | 'SELL'; notionalUsd: number }>();
  const res = await botStub(c.env).fetch('https://bot/trade', { method: 'POST', body: JSON.stringify(body) });
  return new Response(res.body, res);
});

app.get('/api/ws', authRequired, async (c) => {
  return botStub(c.env).fetch('https://bot/ws', c.req.raw);
});

export { BotDurableObject };
export default app;
