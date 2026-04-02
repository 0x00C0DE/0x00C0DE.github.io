# Cloudflare Worker Blog Append API

This Worker provides the append-only blog endpoint used by the terminal `post` command and the live visitor counter used by the terminal site.

## Why this setup

- Free hosting on Cloudflare Workers
- Secrets stay out of the public repo
- GitHub remains the append-only data store
- No local server needed for public use
- Durable Object storage keeps the visitor count exact across requests

## Required secrets

Do not commit real values.

Set them with Wrangler:

```bash
wrangler secret put GITHUB_PAT
wrangler secret put TURNSTILE_SECRET_KEY
wrangler secret put BLOG_IMAGE_DELETE_PASSWORD
```

`TURNSTILE_SECRET_KEY` is optional. If omitted, Turnstile verification is skipped.
`BLOG_IMAGE_DELETE_PASSWORD` is used by the blog image delete button and should be set as a Worker secret, not committed.

## Visitor counter binding

The visitor counter uses a Durable Object named `VisitorCounter`, defined in `wrangler.jsonc`.
This config uses `new_sqlite_classes`, which is required for Durable Objects on Cloudflare's free plan.

After deploying this branch, the Worker exposes:

- `GET /api/visitors`
- `POST /api/visitors/track`
- `POST /api/visitors/leave`

The frontend creates a stable browser visitor ID in `localStorage` plus a per-page visit ID, so the widget can track:

- total visits
- unique visitors
- currently on-site visitors

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
wrangler secret put BLOG_IMAGE_DELETE_PASSWORD
npm run deploy
```

## Frontend wiring

Before `commands.js` loads, set:

```html
<script>
  window.BLOG_POST_API_URL = "https://your-worker-subdomain.workers.dev/api/blog/append";
</script>
```

Current deployed endpoint:

`https://0x00c0de-blog-append.0x00c0de.workers.dev/api/blog/append`

Delete-image endpoint after redeploying this Worker:

- `https://0x00c0de-blog-append.0x00c0de.workers.dev/api/blog/delete-image`

Visitor counter endpoints after redeploying this Worker:

- `https://0x00c0de-blog-append.0x00c0de.workers.dev/api/visitors`
- `https://0x00c0de-blog-append.0x00c0de.workers.dev/api/visitors/track`
- `https://0x00c0de-blog-append.0x00c0de.workers.dev/api/visitors/leave`
