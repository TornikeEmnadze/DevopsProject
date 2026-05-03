const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const activePath = path.join(root, '.local-production', 'active-slot.json');

if (!fs.existsSync(activePath)) {
  console.error('No production state found. Run node scripts/prepare-env.js first.');
  process.exit(1);
}

const state = JSON.parse(fs.readFileSync(activePath, 'utf8'));

if (!state.previous) {
  console.error('Rollback is not available because there is no previous deployment slot.');
  process.exit(1);
}

const rolledBackAt = new Date().toISOString();
fs.writeFileSync(
  activePath,
  `${JSON.stringify(
    {
      active: state.previous,
      previous: state.active,
      updatedAt: rolledBackAt
    },
    null,
    2
  )}\n`
);

console.log(`Rollback completed. Active slot is now ${state.previous}.`);
console.log(`Former active slot kept as rollback target: ${state.active}.`);
