import { appendFile, cp, lstat, mkdir, mkdtemp, readdir } from 'node:fs/promises';
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
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, 'path=' + output + '\n');
console.log(output + ' contains: ' + (await readdir(output)).join(', '));
