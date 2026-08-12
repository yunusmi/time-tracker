# ⏱ Time Tracker

Тайм-трекер в духе Clockify с встроенным **Pomodoro** и выгрузкой выполненных
за день задач в **Excel**.

**Стек:** NestJS + TypeScript + PostgreSQL + Sequelize (backend), Next.js +
TypeScript + CSS (frontend), Swagger (документация), Docker Compose.

> Все контракты API (поля запросов и ответов) — в **snake_case**
> (`access_token`, `started_at`, `task_id`, `estimated_minutes`, …).

## Возможности

- 🔐 **Авторизация** — регистрация/логин, JWT, данные изолированы по пользователю.
- ✅ **Задачи** — название, описание, статус (todo / in progress / done),
  плановое время выполнения (estimate).
- ⏱ **Учёт времени** — таймер start/stop (как в Clockify) **и** ручной ввод
  через два поля времени — «от» (`started_at`) и «до» (`ended_at`); длительность
  считается из разницы. У каждой задачи считается суммарное затреканное время.
- 🍅 **Pomodoro** — настройки (длительность фокуса/перерывов, цикл до длинного
  перерыва, авто-старт) хранятся на сервере; завершённые сессии записываются и
  привязываются к задачам; есть статистика за день.
- 📊 **Экспорт в Excel** — `.xlsx` с тремя листами: *Completed Tasks*,
  *Time Entries*, *Summary* за выбранный день (по умолчанию — сегодня).
- 📚 **Swagger** — интерактивная документация API.

## Структура проекта

```
.
├── backend/            # NestJS API
│   └── src/
│       ├── auth/            # регистрация, логин, JWT
│       ├── users/
│       ├── tasks/          # CRUD задач + статистика
│       ├── time-entries/   # таймер start/stop + ручной ввод
│       ├── pomodoro/       # настройки + сессии + статистика
│       └── export/         # генерация Excel (exceljs)
├── frontend/           # Next.js (App Router)
│   └── src/
│       ├── app/            # страницы: login, register, dashboard, pomodoro
│       ├── components/
│       ├── context/        # AuthContext
│       └── lib/            # API-клиент, типы, форматтеры
├── db/init/            # SQL для расширения uuid-ossp
└── docker-compose.yml
```

## Быстрый старт (Docker Compose)

Требуется только Docker.

```bash
cp .env.example .env          # при необходимости поменяйте секреты
docker compose up --build
```

После запуска:

| Сервис            | URL                                |
| ----------------- | ---------------------------------- |
| Frontend          | http://localhost:3000              |
| Backend API       | http://localhost:3001/api          |
| Swagger           | http://localhost:3001/api/docs     |
| PostgreSQL        | localhost:5433 (в контейнере 5432) |

Откройте http://localhost:3000, зарегистрируйтесь и начинайте трекать время.

## Локальный запуск (без Docker)

Нужен Node.js 18+ и работающий PostgreSQL.

**1. База данных**

```bash
createdb time_tracker
```

> UUID генерируются на стороне Node (Sequelize `UUIDV4`), расширения Postgres
> не требуются.

**2. Backend**

```bash
cd backend
cp .env.example .env          # пропишите доступы к вашей БД
npm install
npm run start:dev             # http://localhost:3001/api
```

**3. Frontend**

```bash
cd frontend
cp .env.example .env.local    # NEXT_PUBLIC_API_URL=http://localhost:3001/api
npm install
npm run dev                   # http://localhost:3000
```

## Переменные окружения

Корневой `.env` (используется docker-compose):

| Переменная            | По умолчанию                   | Назначение                       |
| --------------------- | ------------------------------ | -------------------------------- |
| `DB_USERNAME`         | `postgres`                     | пользователь Postgres            |
| `DB_PASSWORD`         | `postgres`                     | пароль Postgres                  |
| `DB_NAME`             | `time_tracker`                 | имя БД                           |
| `DB_PORT`             | `5432`                         | порт Postgres (локальный запуск) |
| `DB_HOST_PORT`        | `5433`                         | хостовый порт БД в Docker        |
| `JWT_SECRET`          | `super-secret-change-me`       | секрет для подписи JWT           |
| `JWT_EXPIRES_IN`      | `7d`                           | срок жизни токена                |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001/api`    | адрес API для браузера           |

## API (основное)

Все эндпоинты, кроме `register`/`login`/`health`, требуют заголовок
`Authorization: Bearer <token>`.

| Метод | Путь                       | Описание                              |
| ----- | -------------------------- | ------------------------------------- |
| POST  | `/api/auth/register`       | регистрация                           |
| POST  | `/api/auth/login`          | логин, возвращает JWT                 |
| GET   | `/api/auth/me`             | текущий пользователь                  |
| GET   | `/api/tasks`               | список задач со статистикой           |
| POST  | `/api/tasks`               | создать задачу                        |
| PATCH | `/api/tasks/:id`           | обновить (статус, estimate и т.д.)    |
| DELETE| `/api/tasks/:id`           | удалить задачу                        |
| POST  | `/api/time-entries/start`  | запустить таймер                      |
| POST  | `/api/time-entries/stop`   | остановить таймер                     |
| GET   | `/api/time-entries/active` | активный таймер                       |
| POST  | `/api/time-entries`        | ручной ввод (`started_at` + `ended_at`) |
| GET   | `/api/time-entries?date=`  | записи за день                        |
| GET   | `/api/pomodoro/settings`   | настройки Pomodoro                    |
| PATCH | `/api/pomodoro/settings`   | изменить настройки                    |
| POST  | `/api/pomodoro/sessions`   | записать завершённую сессию           |
| GET   | `/api/pomodoro/stats?date=`| статистика за день                    |
| GET   | `/api/export/today?date=`  | **выгрузка задач за день в Excel**    |

Полная интерактивная документация — в Swagger: `/api/docs`.

## Заметки по реализации

- Запуск нового таймера автоматически останавливает текущий (поведение Clockify).
- «Сегодня» в выгрузке/статистике считается по календарному дню в **UTC**
  (можно указать конкретный день параметром `?date=YYYY-MM-DD`).
- Pomodoro-таймер тикает на клиенте; на сервере хранятся настройки и
  завершённые сессии (как и было согласовано).
- ORM — **Sequelize** (`sequelize-typescript` + `@nestjs/sequelize`),
  запускается с `synchronize: true` — схема создаётся автоматически.
  Для production рекомендуется перейти на миграции (`sequelize-cli`).
- Контракты API — в snake_case; внутренние модели и атрибуты тоже названы в
  snake_case, чтобы JSON отдавался без дополнительной трансформации.
