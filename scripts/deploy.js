const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const productionRoot = path.join(root, '.local-production');
const releasesRoot = path.join(productionRoot, 'releases');
const activePath = path.join(productionRoot, 'active-slot.json');

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function copyFileOrDirectory(source, destination) {
  fs.rmSync(destination, { recursive: true, force: true });
  fs.cpSync(source, destination, { recursive: true });
}

execFileSync(process.execPath, [path.join(__dirname, 'prepare-env.js')], {
  stdio: 'inherit'
});

const current = readJson(activePath, { active: null, previous: null });
const nextSlot = current.active === 'blue' ? 'green' : 'blue';
const releasePath = path.join(releasesRoot, nextSlot);

fs.rmSync(releasePath, { recursive: true, force: true });
fs.mkdirSync(releasePath, { recursive: true });

for (const entry of ['src', 'public', 'package.json']) {
  copyFileOrDirectory(path.join(root, entry), path.join(releasePath, entry));
}

const manifest = {
  slot: nextSlot,
  deployedAt: new Date().toISOString(),
  source: 'local-workspace',
  version: readJson(path.join(root, 'package.json'), {}).version || '0.0.0'
};

fs.writeFileSync(path.join(releasePath, 'release-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
fs.writeFileSync(
  activePath,
  `${JSON.stringify(
    {
      active: nextSlot,
      previous: current.active,
      updatedAt: manifest.deployedAt
    },
    null,
    2
  )}\n`
);

console.log(`Deployed ${manifest.version} to ${nextSlot} environment.`);
console.log(`Active slot is now ${nextSlot}.`);
if (current.active) {
  console.log(`Previous slot available for rollback: ${current.active}.`);
}
