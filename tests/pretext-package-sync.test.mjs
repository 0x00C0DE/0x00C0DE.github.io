import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { access, readFile } from 'node:fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

async function readJson(relativePath) {
    return JSON.parse(
        await readFile(path.join(repoRoot, relativePath), 'utf8')
    );
}

test('root package and vendored browser copy stay aligned to @chenglou/pretext', async () => {
    const rootPackage = await readJson('package.json');
    const vendorPackage = await readJson(path.join('vendor', 'pretext', 'package.json'));

    assert.equal(vendorPackage.name, '@chenglou/pretext');
    assert.match(
        rootPackage.dependencies['@chenglou/pretext'],
        new RegExp(vendorPackage.version.replace(/\./g, '\\.'))
    );

    await access(path.join(repoRoot, 'vendor', 'pretext', 'layout.js'));
    await access(path.join(repoRoot, 'vendor', 'pretext', 'analysis.js'));
    await access(path.join(repoRoot, 'pretext-browser.mjs'));
});
