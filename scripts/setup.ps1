param(
  [switch]$Detached = $true
)

$ErrorActionPreference = "Stop"

Write-Host "Validating project files..."
node scripts/validate-environment.js

Write-Host "Preparing local blue-green environment..."
node scripts/prepare-env.js

Write-Host "Starting Docker Compose observability stack..."
if ($Detached) {
  docker compose up --build -d
} else {
  docker compose up --build
}

Write-Host "Environment is ready."
Write-Host "Application: http://localhost:3000"
Write-Host "Grafana: http://localhost:3001"
Write-Host "Prometheus: http://localhost:9090"
Write-Host "Loki: http://localhost:3100"
