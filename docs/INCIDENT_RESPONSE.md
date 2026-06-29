# Incident Response Runbook

## Scope

Use this runbook when the application is down, the Docker healthcheck is unhealthy, or the critical
error-rate alert is firing.

## Triage

1. Check application health:

   ```bash
   curl http://localhost:3000/health
   ```

2. Check Prometheus targets:

   ```text
   http://localhost:9090/targets
   ```

3. Check Grafana logs with Loki:

   ```logql
   {service="devops-task-board"} | json
   ```

4. Check container status:

   ```bash
   docker compose ps
   ```

## Recovery

1. Restart unhealthy local services:

   ```bash
   docker compose restart app
   ```

2. If the local blue-green deployment is broken, roll back:

   ```bash
   node scripts/rollback.js
   node scripts/serve-production.js
   ```

3. Re-run validation:

   ```bash
   npm run validate
   npm run deploy:check
   ```

## Post-Incident Review

Record the alert time, failing endpoint, root cause, recovery action, and any follow-up automation
that would reduce future recovery time.
