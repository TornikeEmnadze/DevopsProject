const fs = require('node:fs');
const http = require('node:http');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { URL } = require('node:url');
const { createTask, getTask, listTasks } = require('./store');

const publicDir = path.join(__dirname, '..', 'public');
const defaultLogPath = path.join(__dirname, '..', 'logs', 'app.log');
const appLogFile = process.env.APP_LOG_FILE || defaultLogPath;

const requestCounters = new Map();
const errorCounters = new Map();
const latency = {
  count: 0,
  sum: 0,
  buckets: new Map([
    [0.05, 0],
    [0.1, 0],
    [0.25, 0],
    [0.5, 0],
    [1, 0],
    [2.5, 0],
    [5, 0],
    [Number.POSITIVE_INFINITY, 0]
  ])
};

const defaultMetricSeries = [
  { method: 'GET', path: '/', status: '200' },
  { method: 'GET', path: '/health', status: '200' },
  { method: 'GET', path: '/work', status: '200' },
  { method: 'GET', path: '/api/tasks', status: '200' },
  { method: 'GET', path: '/fail', status: '500' },
  { method: 'POST', path: '/tasks', status: '201' },
  { method: 'POST', path: '/tasks', status: '400' }
];

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

function increment(map, labels) {
  const key = JSON.stringify(labels);
  const current = map.get(key) || { labels, value: 0 };
  current.value += 1;
  map.set(key, current);
}

function initializeCounter(map, labels) {
  const key = JSON.stringify(labels);
  if (!map.has(key)) {
    map.set(key, { labels, value: 0 });
  }
}

function observeLatency(seconds) {
  latency.count += 1;
  latency.sum += seconds;

  for (const bucket of latency.buckets.keys()) {
    if (seconds <= bucket) {
      latency.buckets.set(bucket, latency.buckets.get(bucket) + 1);
    }
  }
}

function formatLabels(labels) {
  const pairs = Object.entries(labels).map(([key, value]) => {
    const escaped = String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"');
    return `${key}="${escaped}"`;
  });

  return `{${pairs.join(',')}}`;
}

function formatMetrics() {
  const lines = [
    '# HELP app_requests_total Total HTTP requests handled by the application.',
    '# TYPE app_requests_total counter'
  ];

  for (const counter of requestCounters.values()) {
    lines.push(`app_requests_total${formatLabels(counter.labels)} ${counter.value}`);
  }

  lines.push(
    '# HELP app_errors_total Total application errors returned by the application.',
    '# TYPE app_errors_total counter'
  );

  for (const counter of errorCounters.values()) {
    lines.push(`app_errors_total${formatLabels(counter.labels)} ${counter.value}`);
  }

  lines.push(
    '# HELP app_request_duration_seconds HTTP request latency in seconds.',
    '# TYPE app_request_duration_seconds histogram'
  );

  for (const [bucket, value] of latency.buckets.entries()) {
    const label = bucket === Number.POSITIVE_INFINITY ? '+Inf' : String(bucket);
    lines.push(`app_request_duration_seconds_bucket{le="${label}"} ${value}`);
  }

  lines.push(`app_request_duration_seconds_sum ${latency.sum}`);
  lines.push(`app_request_duration_seconds_count ${latency.count}`);

  return `${lines.join('\n')}\n`;
}

function routeLabel(req) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (/^\/tasks\/\d+$/.test(url.pathname)) {
    return '/tasks/:id';
  }

  return url.pathname;
}

function writeJsonLog(payload) {
  const line = `${JSON.stringify(payload)}\n`;
  fs.mkdirSync(path.dirname(appLogFile), { recursive: true });
  fs.appendFileSync(appLogFile, line);
  process.stdout.write(line);
}

function recordRequest(req, res, startedAt) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/metrics') {
    return;
  }

  const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
  const status = String(res.statusCode);
  const labels = {
    method: req.method,
    path: routeLabel(req),
    status
  };

  increment(requestCounters, labels);
  observeLatency(durationSeconds);

  if (res.statusCode >= 500) {
    increment(errorCounters, labels);
  }

  writeJsonLog({
    timestamp: new Date().toISOString(),
    level: res.statusCode >= 500 ? 'error' : 'info',
    message: 'request completed',
    method: req.method,
    path: labels.path,
    status: res.statusCode,
    duration_ms: Math.round(durationSeconds * 100000) / 100,
    remote_addr: req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown'
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
        <p>
          Track deployment tasks while the project demonstrates CI, environment automation,
          deployment, rollback, monitoring, logging, and alerting.
        </p>
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

    if (req.method === 'GET' && url.pathname === '/work') {
      return sendJson(res, 200, {
        result: 'completed',
        duration: 'simulated'
      });
    }

    if (req.method === 'GET' && url.pathname === '/fail') {
      return sendJson(res, 500, {
        error: 'simulated failure'
      });
    }

    if (req.method === 'GET' && url.pathname === '/metrics') {
      return send(res, 200, formatMetrics(), {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8'
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
  for (const labels of defaultMetricSeries) {
    initializeCounter(requestCounters, labels);
    if (labels.status.startsWith('5')) {
      initializeCounter(errorCounters, labels);
    }
  }

  return http.createServer((req, res) => {
    const startedAt = process.hrtime.bigint();
    res.on('finish', () => recordRequest(req, res, startedAt));
    handleRequest(req, res);
  });
}

module.exports = {
  createServer,
  handleRequest
};
