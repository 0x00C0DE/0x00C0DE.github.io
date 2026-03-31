# Blog Append API

This backend accepts append-only blog submissions from the terminal site and writes them to a text file in GitHub through the Contents API.

## Environment

Copy `.env.example` to `.env` and set:

- `GITHUB_PAT`
- `GITHUB_OWNER`
- `GITHUB_REPO`
- `GITHUB_BRANCH`
- `GITHUB_BLOG_PATH`
- `ALLOWED_ORIGIN`

## Run

```bash
npm install
npm run dev
```

The frontend `post` command defaults to:

`http://localhost:8787/api/blog/append`

Override it in production by defining:

```html
<script>
  window.BLOG_POST_API_URL = "https://your-backend.example.com/api/blog/append";
</script>
```

before `commands.js` is loaded.
