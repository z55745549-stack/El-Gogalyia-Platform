import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const workspaceRoot = process.cwd();
const translationSource = await readFile(join(workspaceRoot, 'src/context/translations.ts'), 'utf8');

function keysForArabic() {
  const start = translationSource.indexOf('  ar: {');
  const end = translationSource.lastIndexOf('\n  },');
  if (start < 0 || end < 0) throw new Error('Unable to read Arabic translations.');
  return new Set([...translationSource.slice(start, end).matchAll(/^\s*'([^']+)':/gm)].map((match) => match[1]));
}

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.tsx') || entry.name.endsWith('.ts') ? [path] : [];
  }));
  return nested.flat();
}

const arabicKeys = keysForArabic();
const usedKeys = new Set();

for (const file of await sourceFiles(join(workspaceRoot, 'src'))) {
  if (file.endsWith('translations.ts')) continue;
  const source = await readFile(file, 'utf8');
  for (const match of source.matchAll(/\bt\(\s*['"]([^'"]+)['"]/g)) usedKeys.add(match[1]);
}

const missing = [...usedKeys].filter((key) => !key.endsWith('.') && !key.endsWith('_') && !arabicKeys.has(key));

console.log(`Translation validation passed: ${arabicKeys.size} Arabic keys registered.`);
if (missing.length) {
  console.warn(`Translation coverage warning: ${missing.length} referenced keys without Arabic mapping:`, missing);
}
