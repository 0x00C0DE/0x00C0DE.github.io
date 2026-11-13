import { execFileSync } from 'node:child_process';
import { appendFile, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export function selectLead(report, revision, acceptsSurface = () => true) {
    if (!revision || report?.revision !== revision || !Array.isArray(report.trending?.repositories)) return null;
    return report.trending.repositories.find(repo => /^[\w-]+\/[\w.-]+$/.test(repo?.name)
        && typeof repo.fit?.surface === 'string' && acceptsSurface(repo.fit.surface)) ?? null;
}

export function validateChanges(changes) {
    const allowed = /^(?:README\.md|pages\/[a-z0-9-]+\.(?:html|css|mjs)|src\/codex-feature-[a-z0-9-]+\.(?:mjs|css)|tests\/codex-feature-[a-z0-9-]+\.test\.mjs)$/;
    if (changes.length < 3 || changes.length > 8
        || changes.some(change => change.mode !== '100644' || !allowed.test(change.path))
        || !changes.some(change => change.path === 'README.md')
        || !changes.some(change => change.path.startsWith('tests/'))
        || !changes.some(change => /^(pages|src)\//.test(change.path))) {
        throw new Error('Proposal must include a README update, a feature test, and only allowed regular files');
    }
}

export function reviewApproved(text) {
    try {
        const result = JSON.parse(text);
        return result?.decision === 'approve'
            && Array.isArray(result.findings) && result.findings.length === 0;
    } catch {
        return false;
    }
}

function git(...args) {
    return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1024 * 1024 });
}

function verifyIndex() {
    const files = git('diff', '--cached', '--raw', '--no-renames', '-z').split('\0');
    const changes = [];
    for (let i = 0; i < files.length - 1; i += 2) {
        const match = /^:\d{6} (\d{6}) [a-f0-9]+ [a-f0-9]+ ([AM])$/.exec(files[i]);
        if (!match) throw new Error('Unexpected staged operation');
        changes.push({ mode: match[1], path: files[i + 1] });
    }
    validateChanges(changes);
    const stats = git('diff', '--cached', '--numstat', '--no-renames', '-z').split('\0').filter(Boolean);
    let lines = 0;
    for (const stat of stats) {
        const [added, removed] = stat.split('\t');
        if (!/^\d+$/.test(added) || !/^\d+$/.test(removed)) throw new Error('Binary proposal rejected');
        lines += Number(added) + Number(removed);
    }
    if (lines > 400) throw new Error('Proposal exceeds 400 changed lines');
    git('diff', '--cached', '--check');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    if (process.argv[2] === 'verify') {
        verifyIndex();
    } else if (process.argv[2] === 'review') {
        const approved = reviewApproved(await readFile(process.argv[3], 'utf8'));
        await appendFile(process.env.GITHUB_OUTPUT, 'approved=' + approved + '\n');
    } else {
        const report = JSON.parse(await readFile(process.argv[2], 'utf8'));
        const lead = selectLead(report, process.env.GITHUB_SHA);
        if (lead) {
            await appendFile(process.env.GITHUB_OUTPUT, 'eligible=true\n');
            console.log('Selected a Trending lead for site evaluation.');
        }
    }
}
