# Blog Append Backend

This repo now includes a Cloudflare Worker backend under [worker/](../worker), which is the recommended free hosted option for public use.

The Express backend remains a text-only fallback. It requires a Turnstile secret
and validates both the hostname from `ALLOWED_ORIGIN` and the `blog_post` action.
Run it from the repository checkout because it shares the Worker's verifier.

Recommended production endpoint:

`https://your-worker-subdomain.workers.dev/api/blog/append`

The Express fallback ignores forwarded client IP headers by default. If it runs behind a reverse
proxy, set `TRUSTED_PROXIES` in its local `.env` to a comma-separated list of that proxy's exact
IP addresses or CIDR subnets (for example `127.0.0.1,::1` for a local proxy). Never trust arbitrary
clients: forwarded IPs affect rate limiting and Turnstile verification. The proxy must sanitize
forwarding headers. Invalid entries fail startup. Changing this setting requires a backend restart.

From the repository root in PowerShell, install and verify the fallback with
`npm.cmd --prefix backend ci`, then `npm.cmd --prefix backend test`.

## Blog post validation

The browser checks text before opening media selection or requesting upload
authorization. Both server endpoints validate text independently. The text
limit applies before trimming or collapsing whitespace and covers all text
segments combined. Unsupported control characters, bidirectional embedding
and isolate controls, and malformed Unicode are rejected. The Express
text-only endpoint preserves line breaks and normalizes them to LF.

Posts are stored in a GitHub-backed text file. Reserved timestamp, media, and
escape-marker lines are encoded as literal text when saved. Ordinary
punctuation, Unicode text, and SQL keywords are accepted. The upload path
uses no SQL database.
