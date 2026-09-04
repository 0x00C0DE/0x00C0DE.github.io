import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { normalizeTrustedMediaSource } from '../src/media-source-policy.mjs';

const repositoryRoot = new URL('../', import.meta.url);

function parseVersion(version) {
    return String(version).split('.').map(part => Number.parseInt(part, 10));
}

function versionAtLeast(actual, minimum) {
    const actualParts = parseVersion(actual);
    const minimumParts = parseVersion(minimum);
    for (let index = 0; index < Math.max(actualParts.length, minimumParts.length); index += 1) {
        const difference = (actualParts[index] || 0) - (minimumParts[index] || 0);
        if (difference !== 0) {
            return difference > 0;
        }
    }
    return true;
}

test('backend pins qs to the patched release throughout the dependency tree', async () => {
    const [manifestText, lockfileText] = await Promise.all([
        readFile(new URL('backend/package.json', repositoryRoot), 'utf8'),
        readFile(new URL('backend/package-lock.json', repositoryRoot), 'utf8')
    ]);
    const manifest = JSON.parse(manifestText);
    const lockfile = JSON.parse(lockfileText);
    const installedVersion = lockfile.packages?.['node_modules/qs']?.version;

    assert.equal(manifest.overrides?.qs, '6.16.0');
    assert.ok(installedVersion, 'expected qs in backend/package-lock.json');
    assert.ok(versionAtLeast(installedVersion, '6.16.0'), `qs ${installedVersion} remains vulnerable`);
});

test('media policy permits intended sources and rejects attacker-controlled URLs', () => {
    const pageUrl = 'https://0x00c0de.github.io/pages/blog.html';

    assert.equal(
        normalizeTrustedMediaSource('/assets/banner.png', pageUrl),
        'https://0x00c0de.github.io/assets/banner.png'
    );
    assert.equal(
        normalizeTrustedMediaSource(
            'https://0x00c0de-blog-append.0x00c0de.workers.dev/api/blog/media/example',
            pageUrl
        ),
        'https://0x00c0de-blog-append.0x00c0de.workers.dev/api/blog/media/example'
    );
    assert.match(
        normalizeTrustedMediaSource('data:image/png;base64,iVBORw0KGgo=', pageUrl),
        /^data:image\/png;base64,/
    );
    assert.equal(normalizeTrustedMediaSource('javascript:alert(1)', pageUrl), '');
    assert.equal(normalizeTrustedMediaSource('https://evil.example/pixel.gif', pageUrl), '');
    assert.equal(
        normalizeTrustedMediaSource(
            'https://0x00c0de-blog-append.0x00c0de.workers.dev.evil.example/pixel.gif',
            pageUrl
        ),
        ''
    );
    assert.equal(normalizeTrustedMediaSource('http://i.imgur.com/example.png', pageUrl), '');
    assert.equal(normalizeTrustedMediaSource('data:image/svg+xml,<svg/>', pageUrl), '');
    assert.equal(normalizeTrustedMediaSource('https://user:password@i.imgur.com/example.png', pageUrl), '');
});

test('canvas media loading validates sources before browser URL sinks', async () => {
    const source = await readFile(
        new URL('src/terminal-canvas-core.mjs', repositoryRoot),
        'utf8'
    );

    assert.match(source, /import \{ normalizeTrustedMediaSource \}/);
    assert.match(source, /const trustedSrc = normalizeTrustedMediaSource\(src, window\.location\.href\)/);
    assert.match(source, /image\.src = trustedSrc/);
    assert.match(source, /video\.src = trustedSrc/);
    assert.doesNotMatch(source, /(?:image|video)\.src = src/);
});

test('CodeQL scans code changes with current actions and ignores data-only pushes', async () => {
    const workflow = await readFile(
        new URL('.github/workflows/codeql.yml', repositoryRoot),
        'utf8'
    );

    assert.match(workflow, /actions\/checkout@v7/);
    assert.match(workflow, /github\/codeql-action\/init@v4/);
    assert.match(workflow, /github\/codeql-action\/analyze@v4/);
    assert.match(workflow, /security-events:\s*write/);
    assert.match(workflow, /paths-ignore:\s*[\s\S]*bitcoindata\/\*\*/);
});
