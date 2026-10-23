// Fails if any Markdown file other than the root README.md is tracked by git (D-051, D-053).
import { execFileSync } from 'node:child_process';

const ALLOWED = new Set(['README.md']);

const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean);
const offenders = tracked.filter((path) => /\.(md|markdown)$/i.test(path) && !ALLOWED.has(path));

if (offenders.length > 0) {
  console.error('Markdown files must not be committed (D-051). Remove them from git:');
  for (const path of offenders) console.error(`  - ${path}`);
  process.exit(1);
}
console.log(`OK: no disallowed Markdown files among ${tracked.length} tracked files.`);
