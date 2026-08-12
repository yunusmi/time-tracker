# ⏱ Хронос — Time Tracker

Тайм-трекер в духе Clockify с встроенным **Pomodoro**, проектами, отчётами,
командами и выгрузкой выполненных за день задач в **Excel**.
Интерфейс — редизайн «Хронос»: тёмная/светлая тема, командная палитра ⌘K,
горячие клавиши, фокус-режим.

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
- 🗂 **Проекты** — цвет, инлайн-переименование, архив (записи остаются в
  отчётах), статистика за неделю; задачи привязываются к проекту.
- 📈 **Отчёты** — бар-чарт за 7 дней с выбором дня, серия целей (streak),
  heatmap за 14 дней, разбивка по проектам и топ задач за неделю
  (один запрос `GET /time-entries/summary`).
- 😴 **Контроль простоя** — если таймер идёт, а активности нет дольше порога,
  предлагается «вычесть простой» (стоп с `ended_at` = момент последней
  активности).
- ⚙️ **Настройки пользователя** — цель дня, порог простоя, напоминания
  (Notification API), тема; хранятся на сервере + localStorage.
- 🍅 **Pomodoro** — настройки (длительность фокуса/перерывов, цикл до длинного
  перерыва, авто-старт) хранятся на сервере; завершённые сессии записываются и
  привязываются к задачам; есть статистика за день; опционально фокус-сессии
  записываются в трекер времени; мини-виджет в сайдбаре.
- 👥 **Команда (workspaces)** — участники с ролями (владелец/админ/участник),
  приглашения по email и по ссылке, live-статус «кто что трекает» и агрегаты
  за сегодня/неделю.
- ⌨️ **Палитра ⌘K и горячие клавиши** — запуск таймера по тексту, старт задачи,
  создание задачи, навигация, тема; `S` стоп/продолжить, `N` новая задача,
  `F` фокус-режим, `T` тема, `1–7` экраны, `?` справка (учтена русская
  раскладка).
- 📊 **Экспорт в Excel** — `.xlsx` с тремя листами: *Completed Tasks*,
  *Time Entries*, *Summary* за выбранный день (по умолчанию — сегодня).
- 📚 **Swagger** — интерактивная документация API.

## Структура проекта

```
.
├── backend/            # NestJS API
│   └── src/
│       ├── auth/            # регистрация, логин, JWT
│       ├── users/           # + user_settings (цель дня, простой, тема)
│       ├── tasks/           # CRUD задач + статистика
│       ├── projects/        # проекты: цвет, архив, статистика недели
│       ├── time-entries/    # таймер start/stop + ручной ввод + summary
│       ├── pomodoro/        # настройки + сессии + статистика
│       ├── workspaces/      # команды: участники, роли, приглашения
│       └── export/          # генерация Excel (exceljs)
├── frontend/           # Next.js (App Router)
│   └── src/
│       ├── app/             # login, register, invite/[token],
│       │                    # dashboard: трекер, задачи, проекты, отчёты,
│       │                    #            pomodoro, команда, настройки
│       ├── components/      # Sidebar, Header, палитра ⌘K, фокус-режим…
│       ├── context/         # Auth, Theme, Toast, Settings, Timer, Pomodoro
│       ├── hooks/           # напоминания
│       └── lib/             # API-клиент, типы, форматтеры
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
| GET   | `/api/projects`            | проекты + число задач и время за неделю |
| POST  | `/api/projects`            | создать проект (name, color)          |
| PATCH | `/api/projects/:id`        | переименовать / цвет / архив          |
| DELETE| `/api/projects/:id`        | удалить (задачи остаются без проекта) |
| POST  | `/api/time-entries/start`  | запустить таймер                      |
| POST  | `/api/time-entries/stop`   | остановить (опц. `ended_at` — вычесть простой) |
| GET   | `/api/time-entries/active` | активный таймер                       |
| POST  | `/api/time-entries`        | ручной ввод (`started_at` + `ended_at`) |
| GET   | `/api/time-entries?date=`  | записи за день                        |
| PATCH | `/api/time-entries/:id`    | правка записи (время, описание, задача) |
| GET   | `/api/time-entries/summary?from=&to=` | сводка по дням: total + разбивка по проектам/задачам |
| GET   | `/api/users/me/settings`   | настройки пользователя                |
| PATCH | `/api/users/me/settings`   | цель дня, порог простоя, напоминания, тема |
| GET   | `/api/pomodoro/settings`   | настройки Pomodoro (+ `track_to_timer`) |
| PATCH | `/api/pomodoro/settings`   | изменить настройки                    |
| POST  | `/api/pomodoro/sessions`   | записать завершённую сессию           |
| GET   | `/api/pomodoro/stats?date=`| статистика за день                    |
| GET   | `/api/workspaces/current/members` | участники: роль, live-статус, сегодня/неделя |
| POST  | `/api/workspaces/current/invites` | пригласить по email (admin+)   |
| DELETE| `/api/workspaces/current/invites/:id` | отозвать приглашение       |
| GET   | `/api/workspaces/current/invite-link` | токен ссылки-приглашения   |
| POST  | `/api/invites/:token/accept` | принять приглашение                 |
| GET   | `/api/export/today?date=`  | **выгрузка задач за день в Excel**    |

Полная интерактивная документация — в Swagger: `/api/docs`.

## Заметки по реализации

- Запуск нового таймера автоматически останавливает текущий (поведение Clockify).
- «Сегодня» в выгрузке/статистике считается по календарному дню в **UTC**
  (можно указать конкретный день параметром `?date=YYYY-MM-DD`).
- Pomodoro-таймер тикает на клиенте; на сервере хранятся настройки и
  завершённые сессии (как и было согласовано).
- ORM — **Sequelize** (`sequelize-typescript` + `@nestjs/sequelize`),
  запускается с `synchronize: true` + `sync: { alter: true }` — схема
  создаётся и дополняется автоматически.
  Для production рекомендуется перейти на миграции (`sequelize-cli`).
- Дизайн-референс редизайна — в `design_handoff_chronos_redesign/`
  (HTML-прототип, скриншоты, ТЗ).
- Контракты API — в snake_case; внутренние модели и атрибуты тоже названы в
  snake_case, чтобы JSON отдавался без дополнительной трансформации.
