const assert = require('node:assert/strict');
const { describe, it, beforeEach, afterEach } = require('node:test');
const { createServer } = require('../src/server');
const { resetStore } = require('../src/store');

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve(`http://${address.address}:${address.port}`);
    });
  });
}

describe('DevOps Task Board', () => {
  let server;
  let baseUrl;

  beforeEach(async () => {
    resetStore();
    server = createServer();
    baseUrl = await listen(server);
  });

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('returns a healthy status payload', async () => {
    const response = await fetch(`${baseUrl}/health`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'devops-task-board');
  });

  it('creates a task through the input endpoint and serves it through a dynamic route', async () => {
    const createResponse = await fetch(`${baseUrl}/tasks`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        title: 'Deploy blue version',
        owner: 'dev'
      })
    });

    const created = await createResponse.json();
    const detailResponse = await fetch(`${baseUrl}/tasks/${created.task.id}`);
    const detailHtml = await detailResponse.text();

    assert.equal(createResponse.status, 201);
    assert.equal(created.task.title, 'Deploy blue version');
    assert.equal(detailResponse.status, 200);
    assert.match(detailHtml, /Deploy blue version/);
    assert.match(detailHtml, /Task #1/);
  });

  it('rejects empty task titles', async () => {
    const response = await fetch(`${baseUrl}/tasks`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title: '' })
    });

    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.error, /required/);
  });
});
