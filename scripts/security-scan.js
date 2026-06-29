const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const ignoredDirectories = new Set([
  '.git',
  '.local-production',
  'dist',
  'docs',
  'logs',
  'node_modules'
]);
const checkedExtensions = new Set(['.js', '.json', '.md', '.ps1', '.yml', '.yaml', '']);
const secretPatterns = [
  /aws_access_key_id\s*[:=]\s*["']?[A-Z0-9]{16,}/i,
  /aws_secret_access_key\s*[:=]\s*["']?[A-Za-z0-9/+=]{32,}/i,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /ghp_[A-Za-z0-9]{20,}/,
  /private_key\s*[:=]\s*["']?-----BEGIN/i,
  /api[_-]?key\s*[:=]\s*["']?[A-Za-z0-9_-]{24,}/i
];
const problems = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    const extension = path.extname(entry.name);
    if (!checkedExtensions.has(extension)) {
      continue;
    }

    const relativePath = path.relative(root, fullPath);
    const content = fs.readFileSync(fullPath, 'utf8');
    for (const pattern of secretPatterns) {
      if (pattern.test(content)) {
        problems.push(`${relativePath}: possible committed secret`);
      }
    }
  }
}

function runNpmAuditWhenPossible() {
  if (!fs.existsSync(path.join(root, 'package-lock.json'))) {
    console.log('Skipping npm audit because package-lock.json is not present.');
    return;
  }

  try {
    execFileSync('npm', ['audit', '--audit-level=moderate', '--omit=dev'], {
      cwd: root,
      stdio: 'inherit'
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('Skipping npm audit because npm is not available on this machine.');
      return;
    }
    throw error;
  }
}

walk(root);

const dockerfile = fs.readFileSync(path.join(root, 'Dockerfile'), 'utf8');
if (dockerfile.includes(':latest')) {
  problems.push('Dockerfile should use a pinned base image tag instead of latest');
}
if (!dockerfile.includes('HEALTHCHECK')) {
  problems.push('Dockerfile should define a container healthcheck');
}
if (!dockerfile.includes('USER node')) {
  problems.push('Dockerfile should run the application as the non-root node user');
}

const compose = fs.readFileSync(path.join(root, 'docker-compose.yml'), 'utf8');
if (compose.includes(':latest')) {
  problems.push('docker-compose.yml should use pinned image tags instead of latest');
}
if (!compose.includes('restart: unless-stopped')) {
  problems.push('docker-compose.yml should define restart policies');
}

if (problems.length) {
  console.error('Security validation failed:');
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

runNpmAuditWhenPossible();
console.log('Security validation passed.');
