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

# 3. Запустить всё — любой из вариантов:
#    docker compose --profile dev up -d --build
#    (или, если уже есть .env из шага 2 с COMPOSE_PROFILES=dev): docker compose up -d --build

docker compose --profile dev up -d --build

# 4. Загрузить демо-данные (один раз)
docker compose exec backend python seed.py
```

Приложение: **`http://localhost:5173`**.

**Без `.env`:** используйте **`docker compose --profile dev up -d --build`** — профиль поднимает **backend** и **frontend** (Vite).

**Только БД + backend, фронт на хосте:** `docker compose --profile dev up -d db backend`, затем в `frontend`: `npm install` и `npm run dev`.

**Прод (nginx :80):** в Dokploy задайте **`COMPOSE_PROFILES=prod`**, локально: **`docker compose --profile prod up -d --build`** → **`http://localhost`**.

## Учётные записи (демо)

| Роль | Логин | Пароль |
|---|---|---|
| Менеджер | `manager` | `manager123` |
| Сотрудник | `aleksandrivanо0` | `password123` |

> Полный список сотрудников смотри в БД: `SELECT login FROM users LIMIT 10;`

## Архитектура

```
Docker (по умолчанию): frontend/Vite (:5173) → прокси /api → backend (:8000) → PostgreSQL
Профиль prod:           nginx (:80) → /api → backend_prod → PostgreSQL
npm run dev на хосте:   Vite (:5173) → 127.0.0.1:8000 → контейнер backend
                                  │
                           OR-Tools CP-SAT
                           OpenAI GPT-4o-mini
```

**Docker Compose:** один файл. **`docker compose --profile dev up -d`** или **`cp .env.example .env`** и **`docker compose up -d`** — оба поднимают **5173**. Прод: **`COMPOSE_PROFILES=prod`** или **`docker compose --profile prod up -d`**.

**Локально:** **`docker compose --profile dev up -d --build`** → **`http://localhost:5173`** (не нужно править `.env` ради профиля).

**Прод:** **`COMPOSE_PROFILES=prod`** или **`docker compose --profile prod up -d --build`** → **`http://localhost`**.

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
├── docker-compose.yml    — по умолчанию dev (:5173); профиль prod → nginx (:80)
├── .env.example
├── corecase.md
├── URS.md
├── FS.md
├── PROMPTS.md
└── README.md
```
