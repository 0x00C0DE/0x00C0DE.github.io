import { readFile, writeFile } from 'node:fs/promises';
import { readActivation } from './blog-feed.mjs';

const root = new URL('../../', import.meta.url);
const skill = await readFile(new URL('.agents/skills/0x00c0de-release/SKILL.md', root), 'utf8');
if (!skill.includes('name: 0x00c0de-release')) throw new Error('Missing repository release skill');
const home = new URL('index.html', root);
const next = await readActivation(process.argv[2], home, process.env.GITHUB_SHA);
if (next !== await readFile(home, 'utf8')) await writeFile(home, next);
