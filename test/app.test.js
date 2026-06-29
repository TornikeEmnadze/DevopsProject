const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { resetStore } = require('../src/store');

process.env.APP_LOG_FILE = path.join(os.tmpdir(), 'devops-task-board-test.log');

const { createServer } = require('../src/server');

function startServer() {
  const server = createServer();

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${address.port}`
      });
    });
  });
}

async function withServer(callback) {
  resetStore();
  fs.rmSync(process.env.APP_LOG_FILE, { force: true });
  const { server, baseUrl } = await startServer();

  try {
    await callback(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('health endpoint returns OK status', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.status, 'ok');
    assert.equal(payload.service, 'devops-task-board');
  });
});

test('tasks endpoint creates and returns a task', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/tasks`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: 'Prepare final release',
        owner: 'student'
      })
    });
    const payload = await response.json();

    assert.equal(response.status, 201);
    assert.equal(payload.task.title, 'Prepare final release');

    const taskResponse = await fetch(`${baseUrl}/tasks/${payload.task.id}`);
    const html = await taskResponse.text();

    assert.equal(taskResponse.status, 200);
    assert.match(html, /Prepare final release/);
  });
});

test('empty task titles are rejected', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/tasks`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: ''
      })
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.error, 'Task title is required.');
  });
});

test('metrics endpoint exposes request and error counters', async () => {
  await withServer(async (baseUrl) => {
    await fetch(`${baseUrl}/health`);
    await fetch(`${baseUrl}/fail`);

    const response = await fetch(`${baseUrl}/metrics`);
    const metrics = await response.text();

    assert.equal(response.status, 200);
    assert.match(metrics, /# TYPE app_requests_total counter/);
    assert.match(metrics, /app_requests_total\{method="GET",path="\/health",status="200"\}/);
    assert.match(metrics, /app_errors_total\{method="GET",path="\/fail",status="500"\}/);
  });
});

test('requests are written as JSON logs', async () => {
  await withServer(async (baseUrl) => {
    await fetch(`${baseUrl}/health`);

    const logLine = fs.readFileSync(process.env.APP_LOG_FILE, 'utf8').trim();
    const log = JSON.parse(logLine);

    assert.equal(log.level, 'info');
    assert.equal(log.path, '/health');
    assert.equal(log.status, 200);
    assert.ok(log.timestamp);
  });
});
