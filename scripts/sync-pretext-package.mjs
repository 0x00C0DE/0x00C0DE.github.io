import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, readdir, rm, copyFile, stat } from 'node:fs/promises';

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
        if (!entry.isFile() || !entry.name.endsWith('.js')) {
            continue;
        }

        const sourcePath = path.join(sourceDir, entry.name);
        const destinationPath = path.join(destinationDir, entry.name);
        await copyFile(sourcePath, destinationPath);
    }
}

async function syncPretextPackage() {
    await assertSourceExists(packageRoot);
    await assertSourceExists(packageDistRoot);

    await rm(vendorRoot, { recursive: true, force: true });
    await mkdir(vendorRoot, { recursive: true });

    await copyDistFiles(packageDistRoot, vendorRoot);
    await copyFile(path.join(packageRoot, 'LICENSE'), path.join(vendorRoot, 'LICENSE'));
    await copyFile(path.join(packageRoot, 'package.json'), path.join(vendorRoot, 'package.json'));

    const packageName = '@chenglou/pretext';
    const vendorPath = path.relative(repoRoot, vendorRoot);
    console.log(`Synced ${packageName} into ${vendorPath}`);
}

syncPretextPackage().catch(error => {
    console.error('Unable to sync @chenglou/pretext into vendor/pretext');
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
