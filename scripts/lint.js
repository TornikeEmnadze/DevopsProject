const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const checkedExtensions = new Set(['.js', '.css', '.json', '.md', '.yml']);
const ignoredDirectories = new Set(['.git', 'node_modules', '.local-production', 'dist', 'logs']);
const problems = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (!checkedExtensions.has(path.extname(entry.name))) {
      continue;
    }

    const relativePath = path.relative(root, fullPath);
    const content = fs.readFileSync(fullPath, 'utf8');

    if (content.includes('\t')) {
      problems.push(`${relativePath}: contains tab indentation`);
    }

    if (!content.endsWith('\n')) {
      problems.push(`${relativePath}: missing trailing newline`);
    }

    const lines = content.split('\n');
    lines.forEach((line, index) => {
      if (line.length > 140) {
        problems.push(`${relativePath}:${index + 1}: line exceeds 140 characters`);
      }
      if (/\s+$/.test(line)) {
        problems.push(`${relativePath}:${index + 1}: trailing whitespace`);
      }
    });
  }
}

walk(root);

if (problems.length) {
  console.error('Lint failed:');
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log('Lint passed.');
