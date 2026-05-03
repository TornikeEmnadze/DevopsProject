const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const appDist = path.join(dist, 'app');

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(appDist, { recursive: true });

for (const entry of ['src', 'public', 'scripts', 'package.json', 'README.md']) {
  fs.cpSync(path.join(root, entry), path.join(appDist, entry), { recursive: true });
}

const manifest = {
  name: 'devops-task-board',
  version: JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version,
  builtAt: new Date().toISOString(),
  entrypoint: 'src/index.js'
};

fs.writeFileSync(path.join(dist, 'build-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

console.log('Build completed successfully.');
console.log(`Build output: ${dist}`);
