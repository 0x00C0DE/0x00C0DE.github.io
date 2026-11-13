import { readFile, writeFile } from 'node:fs/promises';
import { activateFeed } from './blog-feed.mjs';
import { sitemapDirective, sitemapEligible } from './sitemap.mjs';

const root = new URL('../../', import.meta.url);
const skill = await readFile(new URL('.agents/skills/0x00c0de-release/SKILL.md', root), 'utf8');
if (!skill.includes('name: 0x00c0de-release')) throw new Error('Missing repository release skill');
const home = new URL('index.html', root);
const report = JSON.parse(await readFile(process.argv[2], 'utf8'));
const html = await readFile(home, 'utf8');
const revision = process.env.GITHUB_SHA;
const next = activateFeed(html, report, revision);
if (next !== html) {
    await writeFile(home, next);
    console.log('blog-feed');
} else if (sitemapEligible(report, revision)) {
    try {
        await writeFile(new URL('robots.txt', root), sitemapDirective, { flag: 'wx' });
        console.log('sitemap');
    } catch (error) {
        if (error.code !== 'EEXIST') throw error;
    }
}
