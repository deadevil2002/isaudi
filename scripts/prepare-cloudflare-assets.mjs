import { copyFile, mkdir, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const appOutput = join(process.cwd(), '.next', 'server', 'app');
const assets = join(process.cwd(), '.open-next', 'assets');

for (const route of ['', 'pricing', 'how-it-works']) {
  const source = join(appOutput, route ? `${route}.html` : 'index.html');
  const destinationDirectory = route ? join(assets, route) : assets;
  await mkdir(destinationDirectory, { recursive: true });
  await copyFile(source, join(destinationDirectory, 'index.html'));
}

async function removeSourceMaps(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await removeSourceMaps(path);
    else if (entry.name.endsWith('.map')) await rm(path);
  }
}

await removeSourceMaps(assets);
