import { execFileSync } from 'node:child_process';
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export function selectDiscovery(report, revision) {
    if (!revision || report?.revision !== revision || !Array.isArray(report.trending?.repositories)) return null;
    const repositories = report.trending.repositories.filter(repo =>
        /^[\w-]+\/[\w.-]+$/.test(repo?.name));
    return repositories.length ? { revision, trending: { repositories } } : null;
}

export function describeHandoff(candidate, runId) {
    if (candidate.discovery) return { lead: `Trending discovery (${runId})`, surface: null };
    const [repo] = candidate.trending.repositories;
    return { lead: repo.name, surface: repo.fit.surface };
}

export function verifyEvaluation(trending, evaluation) {
    if (trending.unavailable?.length) throw new Error('Trending windows unavailable: ' + trending.unavailable.join(', '));
    const windows = ['daily', 'weekly', 'monthly'];
    const expected = new Set(trending.repositories.flatMap(repo => windows
        .filter(window => Number.isInteger(repo.ranks?.[window]))
        .map(window => window + '/' + repo.name)));
    if (windows.some(window => ![...expected].some(key => key.startsWith(window + '/')))) {
        throw new Error('Trending coverage is missing an entire window');
    }
    const readmes = new Map(trending.repositories.map(repo => [repo.name, repo.readme?.text]));
    for (const { window, repository, reason, readmeEvidence } of evaluation.assessments ?? []) {
        if (!reason?.trim() || !expected.delete(window + '/' + repository)) {
            throw new Error('Invalid or duplicate Trending assessment coverage');
        }
        const readme = readmes.get(repository);
        const evidence = typeof readmeEvidence === 'string' && readmeEvidence.trim();
        if (readme ? !evidence || !readme.includes(evidence) : readmeEvidence !== '') {
            throw new Error('Invalid README evidence for ' + repository);
        }
    }
    if (expected.size) throw new Error('Incomplete Trending assessment coverage');
    if (!Array.isArray(evaluation.features)) throw new Error('Missing Trending feature list');
    const titles = new Set();
    for (const feature of evaluation.features) {
        if (typeof feature?.title !== 'string' || !feature.title.trim()
            || /[\u0000-\u001f\u007f]/.test(feature.title) || feature.title.length > 80
            || typeof feature.brief !== 'string' || !feature.brief.trim()
            || feature.brief.length > 3000 || feature.brief.includes('\0')
            || !readmes.get(feature.repository)) {
            throw new Error('Invalid selected Trending feature');
        }
        const title = feature.title.trim().replace(/\s+/g, ' ').toLowerCase();
        if (titles.has(title)) throw new Error('Duplicate Trending feature title');
        titles.add(title);
    }
    return evaluation.features;
}

export function selectLead(report, revision, acceptsSurface = () => true) {
    if (!revision || report?.revision !== revision || !Array.isArray(report.trending?.repositories)) return null;
    return report.trending.repositories.find(repo => /^[\w-]+\/[\w.-]+$/.test(repo?.name)
        && typeof repo.fit?.surface === 'string' && acceptsSurface(repo.fit.surface)
        && !(report.projectNavigationPublished && repo.fit.capability === 'native-project-navigation')) ?? null;
}

export function validateChanges(changes) {
    const allowed = /^(?:README\.md|pages\/[a-z0-9-]+\.(?:html|css|mjs)|src\/codex-feature-[a-z0-9-]+\.(?:mjs|css)|tests\/codex-feature-[a-z0-9-]+\.test\.mjs)$/;
    if (changes.length < 3 || changes.length > 8
        || changes.some(({ mode, previousMode, path }) => !allowed.test(path)
            || (mode !== '100644' && !(mode === '100755' && previousMode === mode)))
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
        const match = /^:(\d{6}) (\d{6}) [a-f0-9]+ [a-f0-9]+ ([AM])$/.exec(files[i]);
        if (!match) throw new Error('Unexpected staged operation');
        changes.push({ previousMode: match[1], mode: match[2], path: files[i + 1] });
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
    if (process.argv[2] === 'describe') {
        const candidate = JSON.parse(await readFile(process.argv[3], 'utf8'));
        console.log(JSON.stringify(describeHandoff(candidate, process.argv[4])));
    } else if (process.argv[2] === 'evaluation') {
        const [, , , reportPath, evaluationPath, selectionPath] = process.argv;
        const report = JSON.parse(await readFile(reportPath, 'utf8'));
        const evaluation = JSON.parse(await readFile(evaluationPath, 'utf8'));
        const feature = verifyEvaluation(report.trending, evaluation);
        await writeFile(selectionPath, JSON.stringify(feature));
        console.log(`Verified ${evaluation.assessments.length} daily, weekly, and monthly Trending assessments.`);
    } else if (process.argv[2] === 'verify') {
        verifyIndex();
    } else if (process.argv[2] === 'review') {
        const approved = reviewApproved(await readFile(process.argv[3], 'utf8'));
        await appendFile(process.env.GITHUB_OUTPUT, 'approved=' + approved + '\n');
    } else {
        const report = JSON.parse(await readFile(process.argv[2], 'utf8'));
        if (selectDiscovery(report, process.env.GITHUB_SHA)) {
            await appendFile(process.env.GITHUB_OUTPUT, 'eligible=true\n');
            console.log('Trending shortlist is available for open-ended site evaluation.');
        }
    }
}
