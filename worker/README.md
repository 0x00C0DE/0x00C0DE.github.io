# Cloudflare Worker Blog Append API

This Worker provides the append-only blog endpoint used by the terminal `post` command and the live visitor counter used by the terminal site.

## Why this setup

- Free hosting on Cloudflare Workers
- Secrets stay out of the public repo
- GitHub remains the append-only data store
- No local server needed for public use
- Durable Object storage deduplicates recent sessions and persists aggregate counts

## Required secrets

Do not commit real values.

Set them with Wrangler:

```bash
wrangler secret put GITHUB_PAT
wrangler secret put TURNSTILE_SECRET_KEY
wrangler secret put BLOG_IMAGE_DELETE_PASSWORD
wrangler secret put GODLIKE_TOTP_SECRET
wrangler secret put BLOG_SIGNING_SECRET
```

Posting and upload grants require Turnstile. Siteverify must return the hostname from
`ALLOWED_ORIGIN` and action `blog_post`. The browser exchanges one successful challenge
for a 15-minute upload grant when it has media to stage. Chunks are scoped to that
grant, duplicate writes with different bytes are rejected, and a grant can submit
only once. Direct posts carry a fresh Turnstile token.

`BLOG_IMAGE_DELETE_PASSWORD` and `GODLIKE_TOTP_SECRET` are required for `su godlike`.
The Worker issues a 15-minute moderation token after both factors pass. Every
moderation endpoint requires that token. If it expires, run `su godlike` again.
Use a separate, randomly generated `BLOG_SIGNING_SECRET` of at least 32 bytes.
It authenticates upload grants, moderation tokens, and new hosted media metadata.
Keep it in the secret store. Rotation invalidates active grants and old media
proofs. Legacy or unverified attachments still render and can be unlinked, but
their backing objects require a separate, reviewed storage reconciliation.

## Visitor counter binding

The visitor counter uses a Durable Object named `VisitorCounter`, defined in `wrangler.jsonc`.
This config uses `new_sqlite_classes`, which is required for Durable Objects on Cloudflare's free plan.

After deploying this branch, the Worker exposes:

- `GET /api/visitors`
- `GET /api/fortune`
- `POST /api/visitors/track`
- `POST /api/visitors/leave`

The frontend creates a stable browser visitor ID in `localStorage` plus a shared per-session ID and random ownership secret. The Worker hashes the session
identity before storing it, deduplicates recent visits, and rate-limits new visits
and session updates. The visitor counter reports approximate public statistics.
Clients can still create distinct sessions within the limits. The widget tracks:

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
wrangler secret put GODLIKE_TOTP_SECRET
wrangler secret put BLOG_SIGNING_SECRET
npm run deploy
```

## Frontend wiring

Before `commands.js` loads, set:

```html
<script>
  window.BLOG_POST_API_URL = "https://your-worker-subdomain.workers.dev/api/blog/append";
  window.TURNSTILE_SITE_KEY = "your-turnstile-sitekey";
</script>
```

The sitekey is public and belongs in the frontend. The secret key stays in Wrangler secrets or local `.dev.vars`.

Current deployed endpoint:

`https://0x00c0de-blog-append.0x00c0de.workers.dev/api/blog/append`

Delete-image endpoint after redeploying this Worker:

- `https://0x00c0de-blog-append.0x00c0de.workers.dev/api/blog/delete-image`

Visitor counter endpoints after redeploying this Worker:

- `https://0x00c0de-blog-append.0x00c0de.workers.dev/api/visitors`
- `https://0x00c0de-blog-append.0x00c0de.workers.dev/api/visitors/track`
- `https://0x00c0de-blog-append.0x00c0de.workers.dev/api/visitors/leave`
