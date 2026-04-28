# ============================================================
# start_dev.ps1 — Запуск без Docker (стабильный способ)
# Запускать из корня проекта: .\start_dev.ps1
# ============================================================

Write-Host "=== Vacation Planner — Запуск без Docker ===" -ForegroundColor Cyan

$BackendDir = "$PSScriptRoot\backend"
$FrontendDir = "$PSScriptRoot\frontend"
$VenvDir = "$BackendDir\.venv"

# --- Backend ---
Write-Host "`n[1/3] Подготовка бэкенда..." -ForegroundColor Yellow

if (-not (Test-Path $VenvDir)) {
    Write-Host "  Создаю виртуальное окружение..." -ForegroundColor Gray
    python -m venv $VenvDir
}

$pip = "$VenvDir\Scripts\pip.exe"
$python = "$VenvDir\Scripts\python.exe"

Write-Host "  Устанавливаю зависимости..." -ForegroundColor Gray
& $pip install -r "$BackendDir\requirements.txt" --quiet

# Создаём .env если нет
$EnvFile = "$PSScriptRoot\.env"
if (-not (Test-Path $EnvFile)) {
    Write-Host "  Создаю .env..." -ForegroundColor Gray
    @"
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/vacation_planner
SECRET_KEY=dev-secret-key-change-in-production
ACCESS_TOKEN_EXPIRE_MINUTES=480
JWT_ALGORITHM=HS256
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
BACKEND_CORS_ORIGINS=http://localhost:5173,http://localhost:3000
ENVIRONMENT=development
"@ | Out-File -FilePath $EnvFile -Encoding utf8
}

Write-Host "  Запускаю бэкенд на http://localhost:8000 ..." -ForegroundColor Green
$BackendJob = Start-Process -FilePath $python -ArgumentList "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload" -WorkingDirectory $BackendDir -PassThru -WindowStyle Minimized

Write-Host "  Жду запуска бэкенда (5 сек)..." -ForegroundColor Gray
Start-Sleep 5

# Засеять базу данных
Write-Host "`n[2/3] Заполняю базу данных..." -ForegroundColor Yellow
try {
    & $python "$BackendDir\seed.py"
    Write-Host "  База данных заполнена!" -ForegroundColor Green
} catch {
    Write-Host "  База уже заполнена или ошибка: $_" -ForegroundColor DarkYellow
}

# --- Frontend ---
Write-Host "`n[3/3] Запускаю фронтенд на http://localhost:5173 ..." -ForegroundColor Yellow
$npm = (Get-Command npm -ErrorAction SilentlyContinue)?.Source
if (-not $npm) {
    Write-Host "  npm не найден! Установи Node.js с https://nodejs.org" -ForegroundColor Red
} else {
    if (-not (Test-Path "$FrontendDir\node_modules")) {
        Write-Host "  Устанавливаю npm-пакеты (первый раз — может занять пару минут)..." -ForegroundColor Gray
        Push-Location $FrontendDir
        npm install
        Pop-Location
    }
    $FrontendJob = Start-Process -FilePath $npm -ArgumentList "run", "dev" -WorkingDirectory $FrontendDir -PassThru -WindowStyle Minimized
}

Write-Host "`n===================================" -ForegroundColor Cyan
Write-Host "  Приложение запущено!" -ForegroundColor Green
Write-Host "  Фронтенд:  http://localhost:5173" -ForegroundColor White
Write-Host "  API docs:  http://localhost:8000/docs" -ForegroundColor White
Write-Host "  Логин менеджера:   manager / manager123" -ForegroundColor White
Write-Host "  Логин сотрудника:  владпопо0 / password123" -ForegroundColor White
Write-Host "===================================" -ForegroundColor Cyan
Write-Host "`nНажми Ctrl+C для остановки или закрой окна терминалов." -ForegroundColor DarkGray

# Держим скрипт открытым
Wait-Process -Id $BackendJob.Id
