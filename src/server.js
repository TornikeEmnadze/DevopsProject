const http = require('node:http');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { URL } = require('node:url');
const { createTask, getTask, listTasks } = require('./store');

const publicDir = path.join(__dirname, '..', 'public');

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function send(res, statusCode, body, headers = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/html; charset=utf-8',
    ...headers
  });
  res.end(body);
}

function sendJson(res, statusCode, payload) {
  send(res, statusCode, JSON.stringify(payload, null, 2), {
    'Content-Type': 'application/json; charset=utf-8'
  });
}

async function parseBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  const contentType = req.headers['content-type'] || '';

  if (contentType.includes('application/json')) {
    return raw ? JSON.parse(raw) : {};
  }

  const params = new URLSearchParams(raw);
  return Object.fromEntries(params.entries());
}

function renderHome(tasks) {
  const taskItems = tasks
    .map(
      (task) => `
        <li>
          <a href="/tasks/${task.id}">${escapeHtml(task.title)}</a>
          <span>${escapeHtml(task.owner)}</span>
        </li>`
    )
    .join('');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>DevOps Task Board</title>
    <link rel="stylesheet" href="/styles.css">
  </head>
  <body>
    <main class="shell">
      <section class="intro">
        <p class="eyebrow">Blue-Green Deployment Demo</p>
        <h1>DevOps Task Board</h1>
        <p>Track deployment tasks while the project demonstrates CI, environment automation, deployment, rollback, and monitoring.</p>
      </section>

      <section class="workspace">
        <form action="/tasks" method="post" class="task-form">
          <label>
            Task title
            <input name="title" placeholder="Prepare production release" required>
          </label>
          <label>
            Owner
            <input name="owner" placeholder="student">
          </label>
          <button type="submit">Create task</button>
        </form>

        <div class="task-list">
          <h2>Current tasks</h2>
          <ul>${taskItems || '<li class="empty">No tasks yet.</li>'}</ul>
        </div>
      </section>
    </main>
  </body>
</html>`;
}

function renderTask(task) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(task.title)} - DevOps Task Board</title>
    <link rel="stylesheet" href="/styles.css">
  </head>
  <body>
    <main class="shell compact">
      <a href="/" class="back-link">Back to board</a>
      <section class="task-detail">
        <p class="eyebrow">Task #${task.id}</p>
        <h1>${escapeHtml(task.title)}</h1>
        <dl>
          <div>
            <dt>Owner</dt>
            <dd>${escapeHtml(task.owner)}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>${escapeHtml(task.createdAt)}</dd>
          </div>
        </dl>
      </section>
    </main>
  </body>
</html>`;
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  try {
    if (req.method === 'GET' && url.pathname === '/') {
      return send(res, 200, renderHome(listTasks()));
    }

    if (req.method === 'GET' && url.pathname === '/styles.css') {
      const css = await readFile(path.join(publicDir, 'styles.css'), 'utf8');
      return send(res, 200, css, { 'Content-Type': 'text/css; charset=utf-8' });
    }

    if (req.method === 'GET' && url.pathname === '/health') {
      return sendJson(res, 200, {
        status: 'ok',
        service: 'devops-task-board',
        timestamp: new Date().toISOString()
      });
    }

    if (req.method === 'GET' && url.pathname === '/api/tasks') {
      return sendJson(res, 200, { tasks: listTasks() });
    }

    if (req.method === 'POST' && url.pathname === '/tasks') {
      const body = await parseBody(req);
      const task = createTask(body.title, body.owner);

      if ((req.headers.accept || '').includes('application/json')) {
        return sendJson(res, 201, { task });
      }

      res.writeHead(303, { Location: `/tasks/${task.id}` });
      return res.end();
    }

    const taskMatch = url.pathname.match(/^\/tasks\/(\d+)$/);
    if (req.method === 'GET' && taskMatch) {
      const task = getTask(taskMatch[1]);
      if (!task) {
        return send(res, 404, '<h1>Task not found</h1>');
      }
      return send(res, 200, renderTask(task));
    }

    return send(res, 404, '<h1>Not found</h1>');
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return sendJson(res, statusCode, {
      error: error.message || 'Unexpected server error'
    });
  }
}

function createServer() {
  return http.createServer(handleRequest);
}

module.exports = {
  createServer,
  handleRequest
};
