import { discoverTrending } from './trending.mjs';
import { appendFile, lstat, mkdir, open, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { discoverFeatures } from './features.mjs';
import { planCycle } from './preflight.mjs';
import { collectReleases } from './releases.mjs';

const [stateDir = 'tmp/codex-research', inputFile] = process.argv.slice(2);
const now = new Date();
const statePath = join(stateDir, 'history.json');
const reportPath = join(stateDir, 'report.json');
let state = { schema: 1, history: [] };

try {
    state = JSON.parse(await readFile(statePath, 'utf8'));
} catch (error) {
    if (error.code !== 'ENOENT') throw error;
}
if (state?.schema !== 1 || !Array.isArray(state.history)) throw new Error('Unsupported release history schema');

const input = inputFile ? JSON.parse(await readFile(inputFile, 'utf8')) : { mode: 'research-only' };
const decision = planCycle({ ...input, now: now.getTime() });
const [result, trending] = await Promise.all([
    collectReleases({ now: now.toISOString(), history: state.history }),
    discoverTrending(),
]);
const root = new URL('../../', import.meta.url);
const skillPath = '.agents/skills/0x00c0de-release/SKILL.md';
const [home, projects, releaseSkill] = await Promise.all(
    ['index.html', 'pages/projects.html', skillPath].map(path => readFile(new URL(path, root), 'utf8')),
);
if (!releaseSkill.includes('name: 0x00c0de-release')) throw new Error('Repository release skill is unavailable');

const blogFile = await open(new URL('content/blog.txt', root));
const blogPrefix = Buffer.alloc(64 * 1024);
let blogBytes;
try {
    ({ bytesRead: blogBytes } = await blogFile.read(blogPrefix));
} finally {
    await blogFile.close();
}
const featureCandidates = discoverFeatures({ home, projects, blog: blogPrefix.toString('utf8', 0, blogBytes) });
const publicPages = (await readdir(new URL('pages/', root))).filter(page => /^project-[a-z0-9-]+\.html$/.test(page));
const existingRobots = await lstat(new URL('robots.txt', root)).catch(error => {
    if (error.code !== 'ENOENT') throw error;
    return null;
});
if (!existingRobots && publicPages.length >= 3) {
    featureCandidates.push({
        id: 'public-sitemap',
        title: 'Publish a sitemap for public portfolio routes',
        evidence: publicPages.length + ' project pages are available and the repository has no robots.txt.',
        acceptance: ['Verify the Pages artifact and deployed sitemap contain the public project index.'],
        inspiration: trending.repositories.filter(repo => repo.fit?.surface === 'sitemap.xml').map(repo => repo.name),
    });
}
const report = {
    schema: 1, observedAt: now.toISOString(), revision: process.env.GITHUB_SHA ?? null,
    decision, ...result, featureCandidates, trending,
    projectNavigationPublished: projects.includes('<nav aria-label="Pinned projects">'),
    handoff: {
        releaseSkill: skillPath,
        instructions: 'Before implementing a selected candidate, load and follow the repository release skill. Verify the evidence on current main and check its acceptance criteria before integration.',
    },
};

await mkdir(stateDir, { recursive: true });
const pendingState = statePath + '.' + process.pid + '.tmp';
await writeFile(pendingState, JSON.stringify({ schema: 1, history: result.history }, null, 2) + '\n', { flag: 'wx' });
await rename(pendingState, statePath);
await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');

const displayTime = decision.windowEndsAt && new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', dateStyle: 'medium', timeStyle: 'long',
}).format(new Date(decision.windowEndsAt));
const summary = [
    '## Codex research preflight',
    '',
    '- Mode — ' + (decision.mode ?? 'research-only'),
    '- Decision — ' + decision.reason,
    '- New upstream releases — ' + result.findings.length,
    '- Sources unavailable — ' + result.unavailable.length,
    ...(decision.phase ? ['- Phase — ' + decision.phase] : []),
    ...(displayTime ? ['- Usage window ends — ' + displayTime] : []),
    ...result.findings.map(finding => '- [' + finding.summary + '](' + finding.source + ')'),
    '',
    '### GitHub Trending evaluation',
    '',
    '- Repositories collected — ' + trending.repositories.length,
    '- READMEs available — ' + trending.repositories.filter(repo => repo.readme.text).length,
    '- READMEs truncated — ' + trending.repositories.filter(repo => repo.readme.status === 'truncated').length,
    '- Windows unavailable — ' + (trending.unavailable.join(', ') || 'none'),
    ...trending.repositories.filter(repo => repo.fit).slice(0, 10).map(repo =>
        '- [' + repo.name + '](https://github.com/' + repo.name + ') — ' + repo.fit.use
        + ' ' + repo.fit.verification + ' Target: `' + repo.fit.surface + '`.'),
    '',
    '### Site feature candidates',
    '',
    ...featureCandidates.map(candidate => '- **' + candidate.title + '** — ' + candidate.evidence),
    ...(featureCandidates.length ? [] : ['- No candidates matched the current checks.']),
    '- Implementation handoff uses the repository release skill at `' + skillPath + '`.',
    '',
].join('\n');
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
console.log(summary);
if (result.unavailable.length) console.warn('Release sources unavailable: ' + result.unavailable.join(', '));
