import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { verifyTurnstile } from '../worker/src/request-security.js';
import { configureProxyTrust } from './proxy-trust.mjs';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 8787);
const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://0x00c0de.github.io';
const githubOwner = process.env.GITHUB_OWNER;
const githubRepo = process.env.GITHUB_REPO;
const githubBranch = process.env.GITHUB_BRANCH || 'main';
const githubBlogPath = process.env.GITHUB_BLOG_PATH || 'content/blog.txt';
const githubPat = process.env.GITHUB_PAT;
const maxPostLength = Number(process.env.MAX_POST_LENGTH || 500);
const turnstileSecretKey = process.env.TURNSTILE_SECRET_KEY || '';

if (!githubOwner || !githubRepo || !githubPat || !turnstileSecretKey) {
    throw new Error('Missing GitHub configuration. Set GITHUB_OWNER, GITHUB_REPO, GITHUB_PAT, and TURNSTILE_SECRET_KEY.');
}

app.use(cors({ origin: allowedOrigin }));
app.use(express.json({ limit: '16kb' }));
configureProxyTrust(app, process.env.TRUSTED_PROXIES);
app.use(rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 3600000),
    max: Number(process.env.RATE_LIMIT_MAX || 10),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'rate limit exceeded' }
}));

app.get('/api/blog/health', (_request, response) => {
    response.json({ ok: true });
});

app.post('/api/blog/append', async (request, response) => {
    try {
        const text = typeof request.body.text === 'string' ? request.body.text.trim() : '';
        const turnstileToken = typeof request.body.turnstileToken === 'string' ? request.body.turnstileToken : '';

        if (!text) {
            return response.status(400).json({ error: 'text is required' });
        }
        if (text.length > maxPostLength) {
            return response.status(400).json({ error: `text must be ${maxPostLength} characters or fewer` });
        }
        if (containsControlCharacters(text)) {
            return response.status(400).json({ error: 'text contains unsupported control characters' });
        }

        if (!await verifyTurnstile(turnstileSecretKey, turnstileToken, request.ip, allowedOrigin, 'blog_post')) {
            return response.status(400).json({ error: 'turnstile verification failed' });
        }
        if (text.split(/\r?\n/).some(line => /^\s*\[/.test(line))) {
            return response.status(400).json({ error: 'text contains a reserved blog marker' });
        }

        const githubFile = await fetchGithubFile();
        const nextContent = appendBlogEntry(githubFile.content, text);
        const commit = await updateGithubFile(nextContent, githubFile.sha);

        return response.status(201).json({
            ok: true,
            commitSha: commit.sha,
            commitUrl: `https://github.com/${githubOwner}/${githubRepo}/commit/${commit.sha}`
        });
    } catch (error) {
        console.error('append failed', error);
        return response.status(500).json({ error: 'failed to append blog entry' });
    }
});

app.listen(port, () => {
    console.log(`blog append api listening on ${port}`);
});

function containsControlCharacters(value) {
    return /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value);
}

async function fetchGithubFile() {
    const response = await fetch(githubContentsUrl(), {
        headers: githubHeaders()
    });

    if (!response.ok) {
        throw new Error(`github fetch failed with ${response.status}`);
    }

    const payload = await response.json();
    return {
        sha: payload.sha,
        content: Buffer.from(payload.content, 'base64').toString('utf8')
    };
}

async function updateGithubFile(content, sha) {
    const response = await fetch(githubContentsUrl(), {
        method: 'PUT',
        headers: {
            ...githubHeaders(),
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: 'Append blog entry via terminal site',
            content: Buffer.from(content, 'utf8').toString('base64'),
            sha,
            branch: githubBranch
        })
    });

    if (!response.ok) {
        const failureBody = await response.text();
        throw new Error(`github update failed with ${response.status}: ${failureBody}`);
    }

    const payload = await response.json();
    return payload.commit;
}

function appendBlogEntry(currentContent, text) {
    const normalized = currentContent.endsWith('\n') ? currentContent : `${currentContent}\n`;
    const timestamp = new Date().toISOString();
    return `${normalized}\n[${timestamp}]\n${text}\n`;
}

function githubContentsUrl() {
    return `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/${encodeURIComponent(githubBlogPath)}?ref=${encodeURIComponent(githubBranch)}`;
}

function githubHeaders() {
    return {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${githubPat}`,
        'User-Agent': '0x00C0DE-blog-append-api',
        'X-GitHub-Api-Version': '2022-11-28'
    };
}
