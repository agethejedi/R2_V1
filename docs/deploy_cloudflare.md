# Cloudflare deployment notes

## Worker

1. Create D1.
2. Add Durable Object namespace.
3. Add secrets.
4. Deploy with Wrangler.

## Web

1. Use Cloudflare's Next.js on Workers support with OpenNext.
2. Set `NEXT_PUBLIC_API_BASE_URL` to the deployed Worker URL.
3. Deploy via `npx opennextjs-cloudflare build && npx wrangler deploy`.

## Recommended initial mode

- asset: ETH-USD
- mode: paper
- aggressiveness: balanced
- live switch: off
