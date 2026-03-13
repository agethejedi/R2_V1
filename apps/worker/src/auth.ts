import { SignJWT, jwtVerify } from 'jose';
import { Context, MiddlewareHandler } from 'hono';
import { Env } from './types';

function secret(env: Env) {
  return new TextEncoder().encode(env.JWT_SECRET);
}

export async function issueToken(env: Env, username: string) {
  return await new SignJWT({ sub: username, role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(secret(env));
}

export const authRequired: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const auth = c.req.header('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  const token = auth.slice(7);
  try {
    await jwtVerify(token, secret(c.env));
    await next();
  } catch {
    return c.json({ error: 'invalid_token' }, 401);
  }
};

export function validAdmin(c: Context<{ Bindings: Env }>, username: string, password: string) {
  return username === c.env.APP_ADMIN_USER && password === c.env.APP_ADMIN_PASSWORD;
}
