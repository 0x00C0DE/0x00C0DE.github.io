# Cloudflare Worker Blog Append API

This Worker provides the append-only blog endpoint used by the terminal `post` command.

## Why this setup

- Free hosting on Cloudflare Workers
- Secrets stay out of the public repo
- GitHub remains the append-only data store
- No local server needed for public use

## Required secrets

Do not commit real values.

Set them with Wrangler:

```bash
wrangler secret put GITHUB_PAT
wrangler secret put TURNSTILE_SECRET_KEY
```

`TURNSTILE_SECRET_KEY` is optional. If omitted, Turnstile verification is skipped.

## Local development

```bash
cd worker
npm install
copy .dev.vars.example .dev.vars
npm run dev
```

Then set real secret values inside `.dev.vars`.

## Deploy

```bash
cd worker
npm install
wrangler login
wrangler secret put GITHUB_PAT
wrangler secret put TURNSTILE_SECRET_KEY
npm run deploy
```

## Frontend wiring

Before `commands.js` loads, set:

```html
<script>
  window.BLOG_POST_API_URL = "https://your-worker-subdomain.workers.dev/api/blog/append";
</script>
```
