const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const logPath = path.join(root, 'logs', 'health-check.log');
const args = new Set(process.argv.slice(2));
const urlIndex = process.argv.indexOf('--url');
const intervalIndex = process.argv.indexOf('--interval');
const url = urlIndex >= 0 ? process.argv[urlIndex + 1] : 'http://127.0.0.1:3000/health';
const intervalMs = intervalIndex >= 0 ? Number.parseInt(process.argv[intervalIndex + 1], 10) : 5000;
const watch = args.has('--watch');

fs.mkdirSync(path.dirname(logPath), { recursive: true });

async function runCheck() {
  const timestamp = new Date().toISOString();
  try {
    const started = Date.now();
    const response = await fetch(url);
    const durationMs = Date.now() - started;
    const status = response.ok ? 'UP' : 'DOWN';
    const line = `${timestamp} ${status} ${response.status} ${durationMs}ms ${url}`;
    fs.appendFileSync(logPath, `${line}\n`);
    console.log(line);
  } catch (error) {
    const line = `${timestamp} DOWN 000 0ms ${url} ${error.message}`;
    fs.appendFileSync(logPath, `${line}\n`);
    console.log(line);
  }
}

runCheck();

if (watch) {
  setInterval(runCheck, intervalMs);
}
