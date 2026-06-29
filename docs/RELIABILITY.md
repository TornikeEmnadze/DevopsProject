# Reliability Plan

## Service Availability Objective

The local production target for the DevOps Task Board is 99% availability during evaluated demo windows.
The service is considered available when `GET /health` returns HTTP 200 within 2 seconds.

## Health Monitoring

- The application exposes `GET /health`.
- Docker Compose defines an application healthcheck.
- Prometheus scrapes `/metrics` every 15 seconds.
- `node scripts/health-check.js --watch` records periodic health results in `logs/health-check.log`.

## Failure Recovery

The project supports two recovery paths:

- Docker Compose services use `restart: unless-stopped`.
- The local blue-green deployment simulation keeps the previous slot available for rollback.

Rollback command:

```bash
node scripts/rollback.js
```

After rollback, run:

```bash
npm run deploy:check
```

or:

```bash
node scripts/smoke-production.js
```

## Alerting Strategy

The critical alert fires when application errors exceed 5 in one minute:

```promql
sum(increase(app_errors_total[1m])) > 5
```

Operators should check Grafana logs for the same time window:

```logql
{service="devops-task-board"} | json | level="error"
```
