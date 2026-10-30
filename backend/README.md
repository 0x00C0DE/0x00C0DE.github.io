# Blog Append Backend

This repo now includes a Cloudflare Worker backend under [worker/](../worker), which is the recommended free hosted option for public use.

The Express backend files remain as a local fallback, but you do not need to run them locally if you deploy the Worker.

Recommended production endpoint:

`https://your-worker-subdomain.workers.dev/api/blog/append`

The Express fallback ignores forwarded client IP headers by default. If it runs behind a reverse
proxy, set `TRUSTED_PROXIES` in its local `.env` to a comma-separated list of that proxy's exact
IP addresses or CIDR subnets (for example `127.0.0.1,::1` for a local proxy). Never trust arbitrary
clients: forwarded IPs affect rate limiting and Turnstile verification. The proxy must sanitize
forwarding headers. Invalid entries fail startup. Changing this setting requires a backend restart.

From the repository root in PowerShell, install and verify the fallback with
`npm.cmd --prefix backend ci`, then `npm.cmd --prefix backend test`.
