import { appendFile, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { selectLead } from './codex-proposal.mjs';

const namePattern = /^Local Codex handoff \| ([\w-]+\/[\w.-]+) \| ([a-z0-9./-]+)$/;
const surfaces = new Set(['index.html', 'pages/bitcoin.html', 'pages/projects.html',
    'src/terminal-canvas-core.mjs', 'sitemap.xml', 'content/feed.xml']);

export function readHandoff(run, jobs, revision) {
    if (!revision || run.head_sha !== revision || run.conclusion !== 'success') return null;
    for (const job of jobs) {
        const match = namePattern.exec(job.name);
        if (job.conclusion !== 'success' || !match || !surfaces.has(match[2])) continue;
        return { revision, trending: { repositories: [{ name: match[1], fit: { surface: match[2] } }] } };
    }
    return null;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const [command, path] = process.argv.slice(2);
    const data = JSON.parse(await readFile(path, 'utf8'));
    if (command === 'announce') {
        const lead = selectLead(data, process.env.GITHUB_SHA);
        if (lead && surfaces.has(lead.fit.surface)) {
            await appendFile(process.env.GITHUB_OUTPUT, 'lead=' + lead.name + ' | ' + lead.fit.surface + '\n');
        }
    } else if (command === 'read') {
        const handoff = readHandoff(data.run, data.jobs, process.argv[4]);
        if (handoff) console.log(JSON.stringify(handoff));
    } else {
        throw new Error('Unknown handoff command');
    }
}
