import { readFile, writeFile } from 'node:fs/promises';
import { sitemapDirective, sitemapEligible } from './sitemap.mjs';

const root = new URL('../../', import.meta.url);
const skill = await readFile(new URL('.agents/skills/0x00c0de-release/SKILL.md', root), 'utf8');
if (!skill.includes('name: 0x00c0de-release')) throw new Error('Missing repository release skill');
const report = JSON.parse(await readFile(process.argv[2], 'utf8'));
const revision = process.env.GITHUB_SHA;
if (sitemapEligible(report, revision)) {
    try {
        await writeFile(new URL('robots.txt', root), sitemapDirective, { flag: 'wx' });
        console.log('sitemap');
    } catch (error) {
        if (error.code !== 'EEXIST') throw error;
    }
}
