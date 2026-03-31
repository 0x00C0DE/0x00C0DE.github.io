# Security & Miscellaneous Review (branch: `unix-style-11`)

Date reviewed: 2026-03-31

## Scope

- `worker/src/index.js`
- `backend/server.js`
- `commands.js`

## Findings

### 1) Blog write endpoint can be abused when Turnstile secret is not configured (High)

**Where**
- Worker: `handleAppend` only verifies Turnstile when `env.TURNSTILE_SECRET_KEY` exists.
- Express fallback: same optional behavior.

**Evidence**
- `worker/src/index.js` checks `if (env.TURNSTILE_SECRET_KEY) { ... verifyTurnstile ... }`.
- `backend/server.js` checks `if (turnstileSecretKey) { ... verifyTurnstile ... }`.

**Impact**
- If the secret is missing in production, any client can submit blog entries (subject only to rate limiting and post length checks).

**Recommendation**
- Make Turnstile mandatory in production (fail startup/deploy if secret is missing), or require an additional server-side auth mechanism for `/api/blog/append`.

---

### 2) Worker rate limiting is isolate-local in-memory state (Medium)

**Where**
- `worker/src/index.js`: `enforceRateLimit` uses a `Map` on `globalThis`.

**Evidence**
- `getInMemoryStore()` creates/returns `globalThis.__BLOG_RATE_LIMITS__`.

**Impact**
- Limits are not globally consistent across isolates/regions and can reset on cold starts/redeploys.
- Attackers can often bypass effective limits by distributing requests.

**Recommendation**
- Move rate limiting to a shared durable store (Durable Object, KV + atomic pattern, or Cloudflare native rate limiting).

---

### 3) Public visitor endpoints are trivially gameable (Low)

**Where**
- `worker/src/index.js`: `POST /api/visitors/track` and `POST /api/visitors/leave` accept caller-provided IDs.

**Evidence**
- Request body is forwarded and accepted after basic format sanitization.

**Impact**
- Anyone can inflate/depress visitor stats by posting arbitrary IDs.
- This is more data integrity than confidentiality/integrity of core systems, but still a trust issue for displayed analytics.

**Recommendation**
- Add anti-abuse controls (per-IP throttling specific to visitor endpoints, signed visit tokens, or bot checks).

---

### 4) CORS fallback to `*` if `ALLOWED_ORIGIN` is unset in Worker (Low)

**Where**
- `worker/src/index.js`: `corsHeaders(origin)` returns `Access-Control-Allow-Origin: origin || '*'`.

**Impact**
- Misconfiguration can silently open APIs to all browser origins.

**Recommendation**
- Fail closed: require `ALLOWED_ORIGIN` and return an error/startup failure if absent.

---

### 5) Misc: duplicate command key in terminal command map (Informational)

**Where**
- `term.js`: `help` appears twice in the `commands` object.

**Impact**
- No direct security impact; last value wins in JavaScript object literals.
- Can confuse maintenance and reviews.

**Recommendation**
- Remove duplicate entry.

## Positive Notes

- Blog post text is length-limited and rejects control characters in both backends.
- GitHub updates use file SHA precondition semantics, preventing silent overwrite races.
- Visitor IDs are sanitized to a constrained character set and maximum length.
