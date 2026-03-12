#!/usr/bin/env node

import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const artifactsDir = path.join(repoRoot, 'apps', 'desktop', 'artifacts');

const main = async () => {
    const desktopPackage = await readJson('apps/desktop/package.json');
    const version = desktopPackage.version;
    const dmgName = `PunchPress-${version}-arm64.dmg`;
    const blockmapName = `${dmgName}.blockmap`;
    const latestMacPath = path.join(artifactsDir, 'latest-mac.yml');

    await assertFileHasContent(path.join(artifactsDir, dmgName), dmgName);
    await assertFileHasContent(path.join(artifactsDir, blockmapName), blockmapName);

    const latestMac = await readFile(latestMacPath, 'utf8');
    assertContains(latestMac, `version: ${version}`, 'latest-mac.yml missing release version');
    assertContains(latestMac, `path: ${dmgName}`, 'latest-mac.yml missing dmg path');
    assertContains(latestMac, `url: ${dmgName}`, 'latest-mac.yml missing dmg url');
    assertContains(latestMac, 'sha512:', 'latest-mac.yml missing sha512');

    console.log('release:check-desktop-artifacts passed');
    console.log(`checked files: ${dmgName}, ${blockmapName}, latest-mac.yml`);
};

await main();

async function readJson(relativePath) {
    const absolutePath = path.join(repoRoot, relativePath);
    return JSON.parse(await readFile(absolutePath, 'utf8'));
}

async function assertFileHasContent(filePath, label) {
    const stats = await stat(filePath);
    if (!stats.isFile() || stats.size < 1) {
        fail(`${label} is missing or empty`);
    }
}

function assertContains(content, expected, message) {
    if (!content.includes(expected)) {
        fail(`${message}: ${expected}`);
    }
}

function fail(message) {
    console.error(`release:check-desktop-artifacts error: ${message}`);
    process.exit(1);
}
