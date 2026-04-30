# Docker dev stack: PostgreSQL + backend :8000 + Vite frontend :5173
# Run from repo root: .\docker-dev-up.ps1
# Requires: docker compose --profile dev (otherwise only db starts).

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "Created .env from .env.example (set OPENAI_API_KEY if needed)." -ForegroundColor Yellow
}

# Ensure dev profile is active even for old .env files.
$envContent = Get-Content ".env" -Raw
if ($envContent -notmatch "(?m)^\s*COMPOSE_PROFILES=") {
    Add-Content ".env" "`nCOMPOSE_PROFILES=dev"
    Write-Host "Added COMPOSE_PROFILES=dev to .env" -ForegroundColor Yellow
}

Write-Host "Starting stack (profile dev)..." -ForegroundColor Cyan
docker compose --profile dev up -d --build

Write-Host "`nContainer status:" -ForegroundColor Cyan
docker compose --profile dev ps

Write-Host "`nOpen: http://localhost:5173" -ForegroundColor Green
Write-Host "API: http://localhost:8000/docs   Login: manager / manager123" -ForegroundColor Gray
Write-Host "`nDemo seed reset: docker compose exec backend python seed.py --reset" -ForegroundColor DarkGray
