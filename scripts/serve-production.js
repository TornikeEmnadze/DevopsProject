const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const productionRoot = path.join(root, '.local-production');
const activePath = path.join(productionRoot, 'active-slot.json');
const configPath = path.join(productionRoot, 'shared', 'production.env.json');

if (!fs.existsSync(activePath)) {
  console.error('Production environment is not prepared. Run node scripts/prepare-env.js and node scripts/deploy.js first.');
  process.exit(1);
}

const state = JSON.parse(fs.readFileSync(activePath, 'utf8'));
if (!state.active) {
  console.error('No active production slot. Run node scripts/deploy.js first.');
  process.exit(1);
}

const releasePath = path.join(productionRoot, 'releases', state.active);
const config = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : {};
const { createServer } = require(path.join(releasePath, 'src', 'server.js'));

const host = process.env.HOST || config.host || '127.0.0.1';
const port = Number.parseInt(process.env.PORT || config.port || '3000', 10);
const server = createServer();

server.listen(port, host, () => {
  console.log(`Production ${state.active} slot listening at http://${host}:${port}`);
});
