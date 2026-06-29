const { execFileSync, spawn } = require('node:child_process');
const path = require('node:path');

const root = path.join(__dirname, '..');
const node = process.execPath;
const healthUrl = process.env.HEALTH_URL || 'http://127.0.0.1:3000/health';

function run(script, args = []) {
  execFileSync(node, [path.join(__dirname, script), ...args], {
    cwd: root,
    stdio: 'inherit'
  });
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForHealth(url) {
  let lastError;

  for (let attempt = 1; attempt <= 20; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        console.log(`Smoke test passed on attempt ${attempt}: ${url}`);
        return;
      }
      lastError = new Error(`Health endpoint returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await delay(500);
  }

  throw lastError;
}

async function main() {
  run('prepare-env.js');
  run('deploy.js');
  run('deploy.js');
  run('rollback.js');

  const server = spawn(node, [path.join(__dirname, 'serve-production.js')], {
    cwd: root,
    stdio: 'inherit'
  });

  try {
    await waitForHealth(healthUrl);
    run('health-check.js', ['--url', healthUrl]);
  } finally {
    server.kill();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
