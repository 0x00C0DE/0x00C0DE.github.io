import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const reactBitsRevision = 'cf2801031f07f53d4684e65b961bde7c2e2a6921';
const upstream = 'https://raw.githubusercontent.com/DavidHDev/react-bits/' + reactBitsRevision + '/';
const tooling = fileURLToPath(new URL('./react-bits-tooling/', import.meta.url));
export const manifestPattern = /^codex-feature-[a-z0-9-]+\.react-bits\.json$/;

export function componentFiles(id, item) {
    if (!/^[A-Za-z0-9]+$/.test(id) || item.name !== id + '-JS-CSS') throw new Error('Invalid React Bits item');
    if (item.dependencies?.length || item.registryDependencies?.length) {
        throw new Error('Unsupported React Bits dependencies for ' + id);
    }
    if (!Array.isArray(item.files) || item.files.length !== 2
        || !['.jsx', '.css'].every(ext => item.files.some(file => file.path === id + ext
            && typeof file.content === 'string' && file.content.trim()))) {
        throw new Error('Unexpected React Bits files for ' + id);
    }
    return item.files;
}

async function fetchText(path) {
    const response = await fetch(upstream + path, { redirect: 'error', signal: AbortSignal.timeout(20_000) });
    if (!response.ok || !response.body) throw new Error('React Bits source unavailable: ' + path);
    let size = 0;
    const chunks = [];
    for await (const chunk of response.body) {
        size += chunk.byteLength;
        if (size > 250_000) throw new Error('React Bits source exceeds size limit: ' + path);
        chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf8');
}

async function loadComponent(id) {
    if (typeof id !== 'string' || !/^[A-Za-z0-9]+$/.test(id)) throw new Error('Invalid React Bits ID');
    return componentFiles(id, JSON.parse(await fetchText('public/r/' + id + '-JS-CSS.json')));
}

export async function buildReactBits(root, output) {
    const sourceDir = join(root, 'src');
    const manifests = (await readdir(sourceDir)).filter(name => manifestPattern.test(name)).sort();
    if (!manifests.length) return;
    const { build } = await import('./react-bits-tooling/node_modules/esbuild/lib/main.js');
    const license = await fetchText('LICENSE.md');
    await writeFile(join(output, 'src', 'react-bits-license.txt'), license);
    const modules = new Map();
    for (const manifest of manifests) {
        const { components } = JSON.parse(await readFile(join(sourceDir, manifest), 'utf8'));
        if (!Array.isArray(components) || components.length < 2 || components.length > 6
            || new Set(components).size !== components.length
            || components.some(id => typeof id !== 'string' || !/^[A-Za-z0-9]+$/.test(id))) {
            throw new Error('Invalid React Bits manifest: ' + manifest);
        }
        for (const id of components) {
            if (!modules.has(id)) {
                modules.set(id, await loadComponent(id));
            }
        }
        const stem = manifest.slice(0, -'.react-bits.json'.length);
        const files = new Map(components.flatMap(id => modules.get(id).map(file => [file.path, file.content])));
        const built = await build({
            absWorkingDir: resolve(root), entryPoints: [join(sourceDir, stem + '.jsx')],
            outfile: join(output, 'src', stem + '.js'), bundle: true, minify: true,
            format: 'esm', jsx: 'automatic', metafile: true, write: false,
            nodePaths: [join(tooling, 'node_modules')], legalComments: 'eof',
            alias: {
                react: join(tooling, 'node_modules', 'react'),
                'react-dom': join(tooling, 'node_modules', 'react-dom'),
            },
            banner: { js: '/* React Bits source ' + reactBitsRevision + '; license: ./react-bits-license.txt */' },
            define: { 'process.env.NODE_ENV': '"production"' },
            plugins: [{
                name: 'pinned-react-bits',
                setup(plugin) {
                    plugin.onResolve({ filter: /^react-bits:/ }, args => {
                        const path = args.path.slice('react-bits:'.length) + '.jsx';
                        if (!files.has(path)) throw new Error('Undeclared React Bits import: ' + args.path);
                        return { path, namespace: 'react-bits' };
                    });
                    plugin.onResolve({ filter: /^\.\//, namespace: 'react-bits' }, args => {
                        const path = args.path.slice(2);
                        if (!files.has(path)) throw new Error('Unknown upstream source file: ' + path);
                        return { path, namespace: 'react-bits' };
                    });
                    plugin.onLoad({ filter: /./, namespace: 'react-bits' }, args => ({
                        contents: files.get(args.path), loader: args.path.endsWith('.css') ? 'css' : 'jsx',
                        resolveDir: tooling,
                    }));
                },
            }],
        });
        for (const id of components) {
            const key = 'react-bits:' + id + '.jsx';
            if (!Object.values(built.metafile.outputs).some(file => file.inputs[key]?.bytesInOutput > 0)) {
                throw new Error('Bundle does not use declared component ' + id);
            }
        }
        for (const file of built.outputFiles) await writeFile(file.path, file.contents);
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const [, , destination, ...ids] = process.argv;
    const files = await Promise.all(ids.map(loadComponent));
    await writeFile(destination, JSON.stringify(files.flat(), null, 2));
}
