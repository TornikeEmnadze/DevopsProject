const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const productionRoot = path.join(root, '.local-production');
const directories = [
  productionRoot,
  path.join(productionRoot, 'releases'),
  path.join(productionRoot, 'releases', 'blue'),
  path.join(productionRoot, 'releases', 'green'),
  path.join(productionRoot, 'shared'),
  path.join(root, 'logs')
];

for (const directory of directories) {
  fs.mkdirSync(directory, { recursive: true });
}

const configPath = path.join(productionRoot, 'shared', 'production.env.json');
if (!fs.existsSync(configPath)) {
  fs.writeFileSync(
    configPath,
    `${JSON.stringify(
      {
        appName: 'DevOps Task Board',
        host: '127.0.0.1',
        port: 3000,
        healthUrl: 'http://127.0.0.1:3000/health'
      },
      null,
      2
    )}\n`
  );
}

const activePath = path.join(productionRoot, 'active-slot.json');
if (!fs.existsSync(activePath)) {
  fs.writeFileSync(
    activePath,
    `${JSON.stringify(
      {
        active: null,
        previous: null,
        updatedAt: null
      },
      null,
      2
    )}\n`
  );
}

console.log('Environment prepared successfully.');
console.log(`Production root: ${productionRoot}`);
console.log(`Config file: ${configPath}`);
