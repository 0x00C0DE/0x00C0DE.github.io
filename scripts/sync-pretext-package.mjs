import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const packageRoot = path.join(repoRoot, 'node_modules', '@chenglou', 'pretext');
const packageDistRoot = path.join(packageRoot, 'dist');
const vendorRoot = path.join(repoRoot, 'vendor', 'pretext');

async function assertSourceExists(targetPath) {
    try {
        await stat(targetPath);
    } catch {
        throw new Error(`missing source path: ${targetPath}`);
    }
}

async function copyDistFiles(sourceDir, destinationDir) {
    const entries = await readdir(sourceDir, { withFileTypes: true });

    for (const entry of entries) {
        if (entry.isDirectory()) {
            const nestedSourcePath = path.join(sourceDir, entry.name);
            const nestedDestinationPath = path.join(destinationDir, entry.name);
            await mkdir(nestedDestinationPath, { recursive: true });
            await copyDistFiles(nestedSourcePath, nestedDestinationPath);
            continue;
        }

        if (!entry.isFile() || !entry.name.endsWith('.js')) {
            continue;
        }

        const sourcePath = path.join(sourceDir, entry.name);
        const destinationPath = path.join(destinationDir, entry.name);
        await copyFile(sourcePath, destinationPath);
    }
}

function replaceRequired(source, search, replacement, label) {
    if (!source.includes(search)) {
        throw new Error(`unable to apply Pretext security patch: ${label}`);
    }
    return source.replace(search, replacement);
}

async function patchRichInline() {
    const targetPath = path.join(vendorRoot, 'rich-inline.js');
    let source = await readFile(targetPath, 'utf8');
    const boundaryHelpers = `const COLLAPSIBLE_BOUNDARY_CHARACTERS = new Set([' ', '\\t', '\\n', '\\f', '\\r']);
function trimCollapsibleBoundaries(text) {
    const hasLeadingWhitespace = text.length > 0 && COLLAPSIBLE_BOUNDARY_CHARACTERS.has(text[0]);
    const hasTrailingWhitespace = text.length > 0 && COLLAPSIBLE_BOUNDARY_CHARACTERS.has(text[text.length - 1]);
    let start = 0;
    while (start < text.length && COLLAPSIBLE_BOUNDARY_CHARACTERS.has(text[start]))
        start++;
    let end = text.length;
    while (end > start && COLLAPSIBLE_BOUNDARY_CHARACTERS.has(text[end - 1]))
        end--;
    return {
        hasLeadingWhitespace,
        hasTrailingWhitespace,
        trimmedText: text.slice(start, end),
    };
}`;

    source = replaceRequired(
        source,
        'const COLLAPSIBLE_BOUNDARY_RE = /[ \\t\\n\\f\\r]+/;',
        boundaryHelpers,
        'rich-inline boundary helper'
    );
    source = replaceRequired(
        source,
        'const LEADING_COLLAPSIBLE_BOUNDARY_RE = /^[ \\t\\n\\f\\r]+/;',
        '',
        'rich-inline leading boundary expression'
    );
    source = replaceRequired(
        source,
        'const TRAILING_COLLAPSIBLE_BOUNDARY_RE = /[ \\t\\n\\f\\r]+$/;',
        '',
        'rich-inline trailing boundary expression'
    );
    source = replaceRequired(
        source,
        '        const hasLeadingWhitespace = LEADING_COLLAPSIBLE_BOUNDARY_RE.test(item.text);',
        '        const boundaryTrim = trimCollapsibleBoundaries(item.text);',
        'rich-inline leading boundary read'
    );
    source = replaceRequired(
        source,
        '        const hasTrailingWhitespace = TRAILING_COLLAPSIBLE_BOUNDARY_RE.test(item.text);',
        '        const { hasLeadingWhitespace, hasTrailingWhitespace, trimmedText } = boundaryTrim;',
        'rich-inline trailing boundary read'
    );
    source = replaceRequired(
        source,
        "        const trimmedText = item.text\n            .replace(LEADING_COLLAPSIBLE_BOUNDARY_RE, '')\n            .replace(TRAILING_COLLAPSIBLE_BOUNDARY_RE, '');",
        '',
        'rich-inline boundary trim'
    );
    source = replaceRequired(
        source,
        'COLLAPSIBLE_BOUNDARY_RE.test(item.text)',
        'hasLeadingWhitespace',
        'rich-inline whitespace-only check'
    );
    await writeFile(targetPath, source, 'utf8');
}

async function patchMeasurement() {
    const targetPath = path.join(vendorRoot, 'measurement.js');
    let source = await readFile(targetPath, 'utf8');
    const linearParser = `function isAsciiDigit(character) {
    return character >= '0' && character <= '9';
}
function isCssWhitespace(character) {
    return character === ' ' || character === '\\t' || character === '\\n' || character === '\\f' || character === '\\r';
}
export function parseFontSize(font) {
    const source = String(font ?? '');
    let index = 0;
    while (index < source.length) {
        if (!isAsciiDigit(source[index])) {
            index++;
            continue;
        }
        const numberStart = index;
        while (index < source.length && isAsciiDigit(source[index]))
            index++;
        if (source[index] === '.' && isAsciiDigit(source[index + 1])) {
            index++;
            while (index < source.length && isAsciiDigit(source[index]))
                index++;
        }
        const numberEnd = index;
        while (index < source.length && isCssWhitespace(source[index]))
            index++;
        if (source[index]?.toLowerCase() === 'p' && source[index + 1]?.toLowerCase() === 'x')
            return Number.parseFloat(source.slice(numberStart, numberEnd));
    }
    return 16;
}`;

    source = replaceRequired(
        source,
        "export function parseFontSize(font) {\n    const m = font.match(/(\\d+(?:\\.\\d+)?)\\s*px/);\n    return m ? parseFloat(m[1]) : 16;\n}",
        linearParser,
        'measurement font-size parser'
    );
    await writeFile(targetPath, source, 'utf8');
}

async function applySecurityPatches() {
    await Promise.all([
        patchRichInline(),
        patchMeasurement()
    ]);
}

async function syncPretextPackage() {
    await assertSourceExists(packageRoot);
    await assertSourceExists(packageDistRoot);

    await rm(vendorRoot, { recursive: true, force: true });
    await mkdir(vendorRoot, { recursive: true });

    await copyDistFiles(packageDistRoot, vendorRoot);
    await copyFile(path.join(packageRoot, 'LICENSE'), path.join(vendorRoot, 'LICENSE'));
    await copyFile(path.join(packageRoot, 'package.json'), path.join(vendorRoot, 'package.json'));
    await applySecurityPatches();

    const packageName = '@chenglou/pretext';
    const vendorPath = path.relative(repoRoot, vendorRoot);
    console.log(`Synced ${packageName} into ${vendorPath}`);
}

syncPretextPackage().catch(error => {
    console.error('Unable to sync @chenglou/pretext into vendor/pretext');
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
