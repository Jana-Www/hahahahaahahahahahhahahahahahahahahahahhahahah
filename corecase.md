# Core Case — AI-планировщик отпусков производственного подразделения

---

## Общий контекст ТЗ

Ваша задача — разработать полноценный веб-сервис с интеграцией AI по описанному заданию и задеплоить его.

Главное в этом задании — не академические знания, а умение создавать продукт от идеи до деплоя: делать это красиво, быстро, инновационно и с AI.

**Важно:** в задании описана база, которая ожидается по итогу. Если хотите сделать больше и лучше — это только приветствуется. Методологию HR можете генерировать с помощью AI или брать из опыта. Тестовые данные и контекст — на вашей стороне, возможностей уточнения нет. Во всех заданиях предполагается, что данные хранятся в разрозненных системах компании.

---

## ★ Легенда

В крупном производственном подразделении с посменным графиком (несколько цехов, десятки сотрудников в каждом) планирование отпусков — ежегодная головная боль. Сезонность производства диктует «горячие» периоды, когда уход ключевых специалистов недопустим. Сменная команда должна обеспечивать непрерывное покрытие производственных линий. При этом у каждого сотрудника свои пожелания: кто-то хочет летом с детьми, кто-то зимой, у кого-то накопились неиспользованные дни. Правила ТК РФ добавляют жёстких ограничений: минимум 14 календарных дней подряд в одной из частей отпуска, общий объём 28 дней, график утверждается заранее. Руководители составляют графики вручную в Excel, конфликты обнаруживаются, когда уже поздно, а HR получает жалобы со всех сторон.

---

## ☰ Функциональные требования

- **Структура подразделения:** цеха, производственные линии/участки, смены; сотрудники с ролью, квалификацией (ключевой специалист / взаимозаменяемый), привязкой к цеху и смене
- **Сезонный календарь:** HR/руководитель размечает «высокий сезон» (запрет или ограничение отпусков), «низкий сезон» (рекомендуемый), минимальное покрытие по цеху/квалификации на каждый период
- **Сбор пожеланий:** сотрудник указывает желаемые периоды (до 3 вариантов с приоритетом), комментарий; система показывает остаток дней отпуска
- **AI-генерация графика отпусков:** оптимальное распределение с учётом пожеланий, сезонности, покрытия, квалификационных ограничений и правил ТК РФ
- **Визуализация:** Gantt-подобный вид по цехам/сменам — кто когда в отпуске; тепловая карта покрытия по неделям (зелёный — норма, жёлтый — на грани, красный — дефицит)
- **Конфликты и предупреждения:** AI подсвечивает: недопокрытие цеха, нарушения ТК (менее 14 дней подряд, превышение лимита), одновременный уход ключевых специалистов
- **Согласование:** руководитель утверждает или корректирует график, сотрудник видит статус (утверждён / на рассмотрении / изменён); AI объясняет причину переноса

---

## AI — Требования к AI

- Генерация оптимального графика с учётом множества взаимоисключающих ограничений (пожелания vs. покрытие vs. ТК)
- Приоритизация пожеланий с обоснованием (почему одно удовлетворено, другое перенесено)
- Выявление и разрешение конфликтов, предложение альтернативных периодов
- Учёт правил ТК РФ (минимум 14 календарных дней подряд, общий объём 28 дней)

---

## ✓ Что сдать

- **Ссылка на работающее приложение** — задеплоенный сервис, доступный по URL
- **Ссылка на репозиторий** — GitHub/GitLab с историей коммитов
- **README** — описание, архитектура, принятые решения, инструкция по запуску
- **История промптов** — файл в формате `.md` с промптами, которые вы писали AI-агенту

---

## Условия

| Параметр | Значение |
|----------|----------|
| Стек | Свободный выбор |
| Срок | 1,5 дня |
| Демо-данные | Подготовить тестовый набор для демонстрации всех функций |

---

## Принятый стек

| Слой | Технология | Обоснование |
|------|-----------|-------------|
| **Frontend** | React + TypeScript + Vite | Быстрая сборка, типобезопасность |
| **UI-компоненты** | Tailwind CSS + shadcn/ui | Готовые компоненты без написания CSS с нуля |
| **Gantt** | Кастомный CSS Grid (React) | Один фиксированный масштаб — проще написать своё |
| **Тепловая карта** | HTML-таблица + Tailwind | 7 цехов × 52 недели с цветом фона — 30 строк JSX |
| **Data fetching** | TanStack Query (React Query) | Кэш, loading/error state из коробки |
| **Backend** | FastAPI (Python) | OR-Tools — Python-библиотека; нет смысла в Node-прослойке |
| **ORM + миграции** | SQLAlchemy + Alembic | Стандарт для FastAPI, миграции одной командой |
| **Async-задачи** | FastAPI BackgroundTasks | Для 50 сотрудников генерация < 60 сек; Redis/Celery избыточны |
| **AI-оптимизация** | Google OR-Tools CP-SAT | Нативный CP-решатель для задачи с ограничениями; `pip install` |
| **LLM** | OpenAI GPT-4o-mini | В 10× дешевле GPT-4o, в 2× быстрее; для 3–4 предложений достаточно |
| **База данных** | PostgreSQL 16 | Надёжность, поддержка UUID, JSON-поля |
| **Контейнеризация** | Docker Compose | dev: `db` + `backend` в Docker, `frontend` — Vite на хосте; prod: все три сервиса в контейнерах |
| **Хостинг** | Railway | Деплой из GitHub за 5 минут, PostgreSQL как сервис |

---

## Архитектура системы

```
┌─────────────────────────────────────────────────────┐
│                  Browser (React SPA)                │
│                                                     │
│  ┌───────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │   Gantt   │ │Heatmap   │ │  Forms / Tables  │   │
│  │ (CSS Grid)│ │(HTML tbl)│ │  (shadcn/ui)     │   │
│  └───────────┘ └──────────┘ └──────────────────┘   │
└─────────────────────┬───────────────────────────────┘
                      │ HTTP · REST API (JSON)
                      │ Authorization: Bearer <JWT>
┌─────────────────────▼───────────────────────────────┐
│               FastAPI Application                   │
│                                                     │
│  /api/v1/auth          /api/v1/schedule             │
│  /api/v1/users         /api/v1/vacation-blocks      │
│  /api/v1/workshops     /api/v1/conflicts            │
│  /api/v1/season-periods /api/v1/dashboard           │
│  /api/v1/wishes                                     │
│                                                     │
│  ┌─────────────────┐    ┌──────────────────────┐    │
│  │  OR-Tools CP-SAT│    │  OpenAI GPT-4o-mini  │    │
│  │  Optimizer      │    │  (LLM explanations)  │    │
│  └─────────────────┘    └──────────────────────┘    │
│                                                     │
│  BackgroundTasks — асинхронный запуск генерации     │
└─────────────────────┬───────────────────────────────┘
                      │ SQLAlchemy (async)
┌─────────────────────▼───────────────────────────────┐
│                  PostgreSQL 16                      │
│  users · workshops · shifts · season_periods        │
│  coverage_rules · wish_requests · vacation_blocks   │
└─────────────────────────────────────────────────────┘
```

**Dev-окружение (текущее):**
```
host machine:
  frontend   → Vite dev server (порт 5173, npm run dev)

Docker Compose:
  backend    → uvicorn FastAPI --reload (порт 8000)
  db         → PostgreSQL 16 (порт 5432, named volume)
```

**Prod-деплой (Docker Compose prod):**
```
services:
  frontend   → nginx (React build, порт 80/443)
  backend    → uvicorn FastAPI 2 workers (порт 8000)
  db         → PostgreSQL 16 (порт 5432, named volume)
```

---

## Схема базы данных

### `workshops` — Цеха
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID PK | |
| name | VARCHAR NOT NULL | Название цеха |

### `shifts` — Смены
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID PK | |
| name | VARCHAR NOT NULL | Первая / Вторая / Третья / Круглосуточная |
| workshop_id | UUID FK → workshops | |

### `users` — Сотрудники
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID PK | |
| full_name | VARCHAR NOT NULL | ФИО |
| login | VARCHAR UNIQUE NOT NULL | Логин |
| password_hash | VARCHAR NOT NULL | bcrypt |
| role | ENUM(EMPLOYEE, MANAGER) | |
| position | VARCHAR | Должность (display) |
| line_text | VARCHAR | Линия/Участок (display, не влияет на логику) |
| qualification | ENUM(KEY, STD) | Ключевой / Взаимозаменяемый |
| shift_id | UUID FK → shifts | Цех определяется через shifts.workshop_id |
| vacation_days_norm | INTEGER DEFAULT 28 | Норма дней отпуска |
| vacation_days_used | INTEGER DEFAULT 0 | Использовано в прошлых периодах |

### `season_periods` — Производственный календарь
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID PK | |
| year | INTEGER | Год планирования |
| date_start | DATE | Начало периода |
| date_end | DATE | Конец периода |
| status | ENUM(HIGH, LOW, NEUTRAL) | Тип сезона |

> Ограничение: периоды одного года не должны пересекаться.

### `coverage_rules` — Нормы покрытия
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID PK | |
| workshop_id | UUID FK → workshops | |
| period_status | ENUM(HIGH, LOW, NEUTRAL) | Применяется к периодам этого типа |
| min_total | INTEGER | Минимум присутствующих сотрудников |
| min_key | INTEGER | Минимум ключевых специалистов (KEY) |
| max_on_vacation | INTEGER NULLABLE | Макс. одновременно в отпуске (для HIGH) |

> UNIQUE(workshop_id, period_status).

### `wish_requests` — Пожелания сотрудников
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID PK | |
| user_id | UUID FK → users | |
| year | INTEGER | |
| is_locked | BOOLEAN DEFAULT false | true после запуска генерации |
| v1_start | DATE NULLABLE | Вариант 1: начало |
| v1_end | DATE NULLABLE | Вариант 1: конец |
| v1_comment | TEXT NULLABLE | |
| v2_start | DATE NULLABLE | Вариант 2: начало |
| v2_end | DATE NULLABLE | Вариант 2: конец |
| v2_comment | TEXT NULLABLE | |
| v3_start | DATE NULLABLE | Вариант 3: начало |
| v3_end | DATE NULLABLE | Вариант 3: конец |
| v3_comment | TEXT NULLABLE | |

> UNIQUE(user_id, year) — одна запись пожеланий на сотрудника в год.

### `vacation_blocks` — Отпускные блоки
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID PK | |
| user_id | UUID FK → users | |
| year | INTEGER | |
| date_start | DATE | Начало отпуска (назначен AI или скорректирован менеджером) |
| date_end | DATE | Конец отпуска |
| status | ENUM(DRAFT, PENDING, APPROVED, MODIFIED, CONFLICT) | |
| wish_variant_used | INTEGER NULLABLE | Какой вариант пожелания был выполнен (1/2/3/null) |
| ai_explanation | TEXT NULLABLE | LLM-объяснение (если пожелание #1 не выполнено) |
| manager_comment | TEXT NULLABLE | Комментарий при изменении дат |
| updated_at | TIMESTAMP | |

> UNIQUE(user_id, year) — один блок на сотрудника в год (MVP).

### `generation_jobs` — Статус генерации
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID PK | |
| year | INTEGER | |
| status | ENUM(RUNNING, DONE, FAILED) | |
| error_message | TEXT NULLABLE | |
| started_at | TIMESTAMP | |
| finished_at | TIMESTAMP NULLABLE | |

---

## Ключевые API-эндпоинты

```
POST   /api/v1/auth/login                    → {token}

GET    /api/v1/workshops                     → список цехов
POST   /api/v1/workshops                     → создать цех
PUT    /api/v1/workshops/{id}                → изменить
DELETE /api/v1/workshops/{id}                → удалить (если нет зависимостей)

GET    /api/v1/workshops/{id}/shifts         → смены цеха
POST   /api/v1/workshops/{id}/shifts         → создать смену

GET    /api/v1/users                         → все сотрудники (MANAGER)
POST   /api/v1/users                         → создать сотрудника
PUT    /api/v1/users/{id}
DELETE /api/v1/users/{id}

GET    /api/v1/season-periods?year=2026      → периоды года
POST   /api/v1/season-periods
PUT    /api/v1/season-periods/{id}
DELETE /api/v1/season-periods/{id}

GET    /api/v1/coverage-rules?workshop_id=   → нормы покрытия
POST   /api/v1/coverage-rules
PUT    /api/v1/coverage-rules/{id}

GET    /api/v1/wishes/my?year=2026           → пожелания текущего сотрудника
PUT    /api/v1/wishes/my?year=2026           → сохранить пожелания
GET    /api/v1/wishes?year=2026              → все пожелания (MANAGER)

POST   /api/v1/schedule/generate?year=2026  → запустить генерацию (async)
GET    /api/v1/schedule/status?year=2026    → статус генерации

GET    /api/v1/vacation-blocks?year=2026    → все блоки (Gantt, MANAGER)
GET    /api/v1/vacation-blocks/my?year=2026 → блок текущего сотрудника
PUT    /api/v1/vacation-blocks/{id}         → approve / modify (MANAGER)

GET    /api/v1/conflicts?year=2026          → конфликты on-the-fly (MANAGER)
GET    /api/v1/dashboard?year=2026          → сводная статистика (MANAGER)
```

---

## Структура репозитория

```
vacation-planner/
├── backend/
│   ├── app/
│   │   ├── api/          — роуты FastAPI
│   │   ├── models/       — SQLAlchemy модели
│   │   ├── schemas/      — Pydantic схемы
│   │   ├── services/     — бизнес-логика
│   │   ├── optimizer/    — OR-Tools CP-SAT
│   │   └── llm/          — OpenAI интеграция
│   ├── alembic/          — миграции БД
│   └── main.py
├── frontend/
│   ├── src/
│   │   ├── pages/        — страницы (Dashboard, Gantt, Wishes, Admin)
│   │   ├── components/   — Gantt, Heatmap, формы
│   │   ├── api/          — React Query хуки
│   │   └── lib/          — утилиты
│   └── vite.config.ts
├── skills/               — AI-скилы и вспомогательные промпт-шаблоны
├── docker-compose.yml
├── docker-compose.deploy.yml
├── .env                  — переменные окружения (не коммитится в git)
├── .env.example          — шаблон .env для онбординга (коммитится)
├── corecase.md           — исходный кейс, стек, архитектура, схема БД
├── URS.md                — пользовательские требования
├── FS.md                 — функциональная спецификация
├── PROMPTS.md            — история промптов (обязательный артефакт кейса)
└── README.md             — описание проекта, инструкция по запуску
```

### `.env` — переменные окружения

```env
# База данных
DATABASE_URL=postgresql+asyncpg://postgres:postgres@db:5432/vacation_planner

# JWT
SECRET_KEY=your-secret-key-here
JWT_ALGORITHM=HS256

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# Приложение
ENVIRONMENT=development   # development | production
BACKEND_CORS_ORIGINS=http://localhost:5173
```

> `.env` добавляется в `.gitignore`. В репозиторий коммитится только `.env.example` с незаполненными значениями.
