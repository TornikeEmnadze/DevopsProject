const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const requiredFiles = [
  'Dockerfile',
  'docker-compose.yml',
  'prometheus/prometheus.yml',
  'prometheus/alert_rules.yml',
  'promtail/promtail-config.yml',
  'loki/loki-config.yml',
  'grafana/provisioning/datasources/datasources.yml',
  'grafana/provisioning/alerting/alert-rules.yml',
  'grafana/provisioning/dashboards/dashboards.yml',
  'grafana/dashboards/observability-lab.json',
  'src/index.js',
  'src/server.js',
  'scripts/prepare-env.js',
  'scripts/deploy.js',
  'scripts/rollback.js'
];

const requiredComposeServices = ['app', 'prometheus', 'grafana', 'loki', 'promtail'];
const problems = [];

function read(filePath) {
  return fs.readFileSync(path.join(root, filePath), 'utf8');
}

for (const filePath of requiredFiles) {
  if (!fs.existsSync(path.join(root, filePath))) {
    problems.push(`Missing required file: ${filePath}`);
  }
}

if (!problems.length) {
  const compose = read('docker-compose.yml');
  for (const service of requiredComposeServices) {
    if (!compose.includes(`  ${service}:`)) {
      problems.push(`docker-compose.yml does not define ${service}`);
    }
  }

  if (!compose.includes('condition: service_healthy')) {
    problems.push('docker-compose.yml should wait for the app healthcheck');
  }

  const prometheus = read('prometheus/prometheus.yml');
  if (!prometheus.includes('app:3000')) {
    problems.push('Prometheus is not configured to scrape the app service on port 3000');
  }

  const alerts = read('prometheus/alert_rules.yml');
  if (!alerts.includes('sum(increase(app_errors_total[1m])) > 5')) {
    problems.push('Prometheus CRITICAL error-rate alert is missing');
  }

  JSON.parse(read('grafana/dashboards/observability-lab.json'));
}

if (problems.length) {
  console.error('Environment validation failed:');
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log('Environment validation passed.');
