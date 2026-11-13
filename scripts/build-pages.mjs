import { renderSitemap, sitemapDirective } from './research/sitemap.mjs';
import { feedLink, renderFeedFile } from './research/blog-feed.mjs';
import { appendFile, cp, lstat, mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceRoot = new URL('../', import.meta.url);
const root = fileURLToPath(sourceRoot);
const temp = new URL('tmp/', sourceRoot);
const publicEntries = ['.nojekyll', 'index.html', 'assets', 'bitcoindata', 'content', 'pages', 'src', 'vendor'];

await mkdir(temp, { recursive: true });
const output = await mkdtemp(fileURLToPath(new URL('pages-artifact-', temp)));
for (const entry of publicEntries) {
    await cp(new URL(entry, sourceRoot), output + sep + entry, {
        recursive: true,
        filter: async source => {
            if ((await lstat(source)).isSymbolicLink()) return false;
            const segments = relative(root, source).split(sep);
            if (segments.length === 1 && segments[0] === '.nojekyll') return true;
            return !segments.some(part => part.startsWith('.') || part === 'node_modules');
        }
    });
}
if ((await readFile(new URL('index.html', sourceRoot), 'utf8')).includes(feedLink)) {
    const feed = await renderFeedFile(new URL('content/blog.txt', sourceRoot));
    await writeFile(output + sep + 'content' + sep + 'feed.xml', feed);
}
const robots = await readFile(new URL('robots.txt', sourceRoot), 'utf8').catch(error => {
    if (error.code !== 'ENOENT') throw error;
    return null;
});
if (robots !== null) {
    await writeFile(output + sep + 'robots.txt', robots);
    if (robots.split(/\r?\n/).includes(sitemapDirective.trim())) {
        const pages = await readdir(output + sep + 'pages', { withFileTypes: true });
        await writeFile(output + sep + 'sitemap.xml', renderSitemap(pages.filter(page => page.isFile()).map(page => page.name)));
    }
}
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, 'path=' + output + '\n');
console.log(output + ' contains: ' + (await readdir(output)).join(', '));
