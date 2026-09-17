import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const workspaceRoot = process.cwd();
const translationSource = await readFile(join(workspaceRoot, 'src/context/translations.ts'), 'utf8');

function keysFor(language) {
  const start = translationSource.indexOf(`  ${language}: {`);
  const end = language === 'ar'
    ? translationSource.indexOf('\n  en: {', start)
    : translationSource.lastIndexOf('\n  },');
  if (start < 0 || end < 0) throw new Error(`Unable to read ${language} translations.`);
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

const arabicKeys = keysFor('ar');
const englishKeys = keysFor('en');
const onlyArabic = [...arabicKeys].filter((key) => !englishKeys.has(key));
const onlyEnglish = [...englishKeys].filter((key) => !arabicKeys.has(key));
const usedKeys = new Set();

for (const file of await sourceFiles(join(workspaceRoot, 'src'))) {
  if (file.endsWith('translations.ts')) continue;
  const source = await readFile(file, 'utf8');
  for (const match of source.matchAll(/\bt\(\s*['"]([^'"]+)['"]/g)) usedKeys.add(match[1]);
}

const missing = [...usedKeys].filter((key) => !key.endsWith('.') && !key.endsWith('_') && (!arabicKeys.has(key) || !englishKeys.has(key)));
if (onlyArabic.length || onlyEnglish.length) {
  console.error('Translation validation failed.');
  if (onlyArabic.length) console.error(`Only Arabic: ${onlyArabic.join(', ')}`);
  if (onlyEnglish.length) console.error(`Only English: ${onlyEnglish.join(', ')}`);
  process.exit(1);
}

console.log(`Translation validation passed: ${arabicKeys.size} keys in Arabic and English.`);
if (missing.length) console.warn(`Translation coverage warning: ${missing.length} referenced keys still rely on their local fallback text.`);
