# Vacation Planner — AI-планировщик отпусков

> Веб-сервис для автоматизированного планирования отпусков в производственном подразделении с посменным графиком.

## Стек

| Слой | Технология |
|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Backend | FastAPI (Python 3.12) + SQLAlchemy async |
| AI-оптимизация | Google OR-Tools CP-SAT |
| LLM-объяснения | OpenAI GPT-4o-mini |
| База данных | PostgreSQL 16 |
| Контейнеризация | Docker Compose |

## Быстрый старт (dev)

```bash
# 1. Клонировать репозиторий
git clone git@github.com:Jana-Www/hahahahaahahahahahhahahahahahahahahahahhahahah.git
cd hahahahaahahahahahhahahahahahahahahahahhahahah

# 2. Создать .env из шаблона
cp .env.example .env
# Заполнить OPENAI_API_KEY в .env

# 3. Запустить всё
docker compose up -d --build

# 4. Загрузить демо-данные (один раз)
docker compose exec backend python seed.py
```

Приложение: **`http://localhost:5173`**.

**Только БД + backend, фронт на хосте:** `docker compose up -d db backend`, затем в `frontend`: `npm install` и `npm run dev`.

**Прод (Dokploy):** в проекте укажите файл **`docker-compose.deploy.yml`**, затем Deploy → **`http://localhost`** (или домен) на порту **80** контейнера.

## Учётные записи (демо)

| Роль | Логин | Пароль |
|---|---|---|
| Менеджер | `manager` | `manager123` |
| Сотрудник | `aleksandrivanо0` | `password123` |

> Полный список сотрудников смотри в БД: `SELECT login FROM users LIMIT 10;`

## Архитектура

```
Локально (docker-compose.yml):  Vite (:5173) → прокси /api → backend (:8000) → PostgreSQL
Прод (docker-compose.deploy.yml): nginx (:80) → /api → backend → PostgreSQL
npm run dev на хосте:            Vite (:5173) → 127.0.0.1:8000 → контейнер backend
                                            │
                                     OR-Tools CP-SAT
                                     OpenAI GPT-4o-mini
```

**Локально:** **`docker compose up -d --build`** → **`http://localhost:5173`**.

**Прод / Dokploy:** файл **`docker-compose.deploy.yml`** (nginx + сборка фронта).

## Ключевые функции

- **JWT-аутентификация** с разграничением ролей (EMPLOYEE / MANAGER)
- **Сбор пожеланий** — до 3 вариантов с приоритетами, предупреждения о HIGH-сезоне
- **AI-генерация графика** — OR-Tools CP-SAT решает задачу с ограничениями:
  - HC-1/HC-2: минимальное покрытие цеха (total + KEY специалисты)
  - HC-3/HC-4: квоты в высокий сезон
  - HC-5: не менее 14 дней подряд (ТК РФ ст. 125)
  - HC-6: не превышение нормы дней
- **LLM-объяснения** — GPT-4o-mini генерирует объяснение на русском при переносе отпуска
- **Диаграмма Ганта** — все сотрудники по цехам/сменам с цветовыми статусами
- **Тепловая карта** — покрытие по неделям (зелёный / жёлтый / красный)
- **Согласование** — менеджер утверждает или изменяет даты (с комментарием)
- **Конфликты** — автоматическое выявление нарушений (C-01…C-05)

## API

Документация Swagger (при запущенном backend из Compose): **http://127.0.0.1:8000/docs**

Основные эндпоинты:
```
POST /api/v1/auth/login
GET  /api/v1/workshops
GET  /api/v1/users
GET  /api/v1/wishes/my?year=2026
PUT  /api/v1/wishes/my?year=2026
POST /api/v1/schedule/generate?year=2026
GET  /api/v1/schedule/status?year=2026
GET  /api/v1/vacation-blocks?year=2026
GET  /api/v1/conflicts?year=2026
GET  /api/v1/dashboard?year=2026
```

## Структура репозитория

```
├── backend/
│   ├── app/
│   │   ├── api/v1/       — FastAPI роутеры
│   │   ├── models/       — SQLAlchemy модели
│   │   ├── schemas/      — Pydantic схемы
│   │   ├── optimizer/    — OR-Tools CP-SAT
│   │   └── llm/          — OpenAI интеграция
│   ├── main.py
│   ├── seed.py           — демо-данные
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── pages/        — страницы (Login, Employee, Manager)
│       ├── components/   — Layout, ProtectedRoute
│       └── lib/          — api, auth, types, utils
├── docker-compose.yml         — локально: db + backend + Vite (:5173)
├── docker-compose.deploy.yml — Dokploy/прод: nginx (:80) + backend
├── .env.example
├── corecase.md
├── URS.md
├── FS.md
├── PROMPTS.md
└── README.md
```
