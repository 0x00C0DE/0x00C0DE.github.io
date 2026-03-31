# Blog Append Backend

This repo now includes a Cloudflare Worker backend under [worker/](../worker), which is the recommended free hosted option for public use.

The Express backend files remain as a local fallback, but you do not need to run them locally if you deploy the Worker.

Recommended production endpoint:

`https://your-worker-subdomain.workers.dev/api/blog/append`
