# Handoff: Редизайн Time Tracker «Хронос» (yunusmi/time-tracker)

Полное ТЗ для внедрения нового дизайна и фичей в существующий репозиторий.
**Репозиторий:** `yunusmi/time-tracker` (branch `main`) — NestJS + TypeScript + PostgreSQL + Sequelize (backend, API в **snake_case**), Next.js App Router + TypeScript (frontend). Swagger: `/api/docs`.

## О файлах дизайна
`Time Tracker Redesign v2.dc.html` (+ `support.js`, открывается в браузере) — **дизайн-референс в HTML**, кликабельный прототип. Это НЕ production-код: задача — **воссоздать** экраны и поведение в Next.js-фронтенде репозитория его паттернами (app router, `lib/api.ts`, `context/AuthContext`). `Time Tracker Redesign.dc.html` — ранняя версия, можно игнорировать.

## Fidelity
**High-fidelity.** Цвета, типографика, отступы, радиусы, состояния — финальные, воспроизводить точно.

## Дизайн-токены
Тёмная тема (по умолчанию):
- `--bg:#0d0e12; --surface:#141519; --surface2:#1b1d24; --border:#24262f; --border2:#30333e; --text:#e8e9ed; --muted:#8b8f9a`
- Акцент `--accent:#6366f1`, подложка акцента `--asoft:rgba(99,102,241,.15)`
- Семантика: green `#34d399` (+`rgba(52,211,153,.14)`), amber `#fbbf24` (+`rgba(251,191,36,.14)`), red `#f87171` (+`rgba(248,113,113,.12)`)
- Тень поповеров: `0 10px 28px rgba(0,0,0,.45)`

Светлая тема: `--bg:#f5f5f7; --surface:#fff; --surface2:#f0f0f3; --border:#e4e5ea; --border2:#d3d4dc; --text:#191a1f; --muted:#6b6e78; green #059669; amber #b45309; red #dc2626`. Переключение — атрибут `data-theme` на корне, хранить в localStorage + настройках.

Типографика: UI — **Instrument Sans** (400/500/600/700), все цифры/время — **JetBrains Mono** (500–700, `font-variant-numeric:tabular-nums`). Базовый размер 13.5px/1.45. Цвета проектов: `#60a5fa #f472b6 #fbbf24 #34d399 #a78bfa #f87171`.

Радиусы: кнопки/инпуты 7–8px, карточки 10–12px, чипы 99px. Карточка = `background:var(--surface); border:1px solid var(--border)`. Границы фокуса инпутов — `--accent`.

## Структура приложения
Сайдбар 214px (лого «Хронос», навигация: Трекер, Задачи, Проекты, Отчёты, Pomodoro, Команда, Настройки; внизу — мини-виджет Pomodoro (когда идёт и открыт другой экран), переключатель темы, профиль). Шапка 52px: заголовок экрана, кнопка «⌘K Поиск и команды», чип активного таймера (виден на всех экранах кроме Трекера: пульсирующая точка, название, время, кнопка «Стоп»). Контент: max-width 980px по центру.

## Экраны (детали смотреть в прототипе)

### 1. Трекер (`/dashboard`)
- Строка старта: input «Над чем работаете?» (Enter=старт), dropdown «Задача (необязательно)», кнопка «▶ Старт». При активном таймере вместо неё — карточка с рамкой `--accent`: пульс-точка, название+проект, крупное время (JetBrains Mono 30px), кнопки ⛶ (фокус-режим) и «■ Стоп» (red).
- Чипы «Продолжить:» — до 3 последних уникальных работ (по task_id/описанию), клик = старт.
- 3 stat-карточки: Сегодня (+прогресс-бар к цели дня), Эта неделя (+среднее/день), Pomodoro сегодня.
- Таймлайн дня 08:00–20:00: полоса 28px, сегменты записей цветом проекта, активная — акцентом с пульсом, title-тултип.
- «Записи за сегодня»: время `HH:MM–HH:MM` (клик = инлайн-редактирование двух `<input type=time>` + ✓), цвет проекта, название, бейджи «вручную»/«идёт», длительность, ✕ удалить. Кнопки «+ Вручную» (форма: описание, задача, с, до, превью длительности) и «↓ Экспорт .xlsx» (существующий `/api/export/today`). Итого за день внизу.
- Idle-баннер (amber): «Похоже, вы отошли» + «Я работаю» / «Стоп и вычесть простой» (стоп с `ended_at` = момент последней активности).

### 2. Задачи
Фильтр-сегмент (Все/Активные/Готово), «+ Новая задача» (название, проект, оценка в мин, Enter=создать). Строка: статус-бейдж с dropdown (К работе=серый / В работе=amber / Готово=green, у done название зачёркнуто), название (клик = инлайн-переименование, Enter/Escape), проект+счётчик pomodoro, прогресс «затрекано из оценки» (бар amber при >100%), ▶ старт таймера (стартуя — останавливает текущий, поведение Clockify уже в API), ✕ удалить.

### 3. Проекты (новый)
Форма создания: название + 6 цветовых свотчей + «+ Создать». Список: свотч, название (инлайн-переименование), «N задач(и)», «за неделю Xч» с баром, «В архив» (архив скрывает из выпадающих списков, записи остаются в отчётах).

### 4. Отчёты
Сетка 1.6fr/1fr. Слева: бар-чарт 7 дней (клик по дню выбирает его; подпись часов над баром, выбранный — акцент) + список записей выбранного дня. Справа: «Серия целей» (streak дней подряд с выполненной целью + heatmap 14 дней, интенсивность = % цели), «По проектам · неделя» (бары), «Топ задач · неделя» (топ-5), карточка «Экспорт .xlsx».

### 5. Pomodoro
Сегмент Фокус/Перерыв/Длинный. Кольцо `conic-gradient` 216px (фокус=accent, перерыв=green, длинный=amber), внутри JetBrains Mono 44px + «фаза · цикл N из M». Старт/Пауза/Сброс. Dropdown «Задача для фокус-сессий». Справа: статы дня (сессии/фокус/перерывы), настройки (фокус/перерыв/длинный, «длинный каждые», автостарт) — уже есть в API `/api/pomodoro/settings`; новый чекбокс «Записывать фокус-сессии в трекер» (по завершении фокус-сессии создаётся time-entry на её длительность). Мини-виджет в сайдбаре при уходе с экрана.

### 6. Команда (новый, нужен бэкенд)
Тулбар: «N участников», «+ Пригласить» → панель: email, роль (Участник/Админ, сегмент), «Отправить», «Копировать ссылку». Таблица: аватар-инициалы, имя (+бейдж «вы»), роль, live-статус («Трекает „задача“» с зелёной точкой / «Не в сети»), Сегодня, Неделя. Ниже — отправленные приглашения с «Отозвать».

### 7. Настройки
Цель дня (слайдер 1–12ч), порог idle (слайдер 1–30 мин), напоминания (2 чекбокса: начать день / цель достигнута), тема (сегмент).

### Оверлеи
- **⌘K палитра** (Cmd/Ctrl+K): input + список: «Запустить таймер: „текст“», задачи (старт), «Создать задачу: „текст“», навигация, тема. ↑↓ выбор, Enter, Esc. Фон `rgba(0,0,0,.5)`, окно 520px, top 12vh.
- **Справка «?»**: список хоткеев (окно 360px).
- **Фокус-режим** (F/⛶): полноэкранно — проект, название, время 96px, «■ Стоп», «Выйти (Esc)».
- Тосты: фикс. право-низ, surface-карточка, ~2.6с.

### Горячие клавиши (игнорировать при фокусе в input)
⌘K палитра · S стоп/продолжить последнюю · N новая задача · F фокус-режим · T тема · 1–7 экраны · ? справка · Esc закрыть. Учитывать русскую раскладку (ы=s, т=n, а=f, е=t).

---

## ТЗ Frontend (Next.js, `frontend/`)
1. Заменить текущие страницы dashboard/pomodoro новой оболочкой: layout с сайдбаром+шапкой (client component), маршруты `/dashboard` (трекер), `/dashboard/tasks`, `/dashboard/projects`, `/dashboard/reports`, `/dashboard/pomodoro`, `/dashboard/team`, `/dashboard/settings`.
2. Подключить шрифты через `next/font/google` (Instrument Sans, JetBrains Mono). Токены — CSS-переменные в `globals.css` с `[data-theme]`.
3. Состояние таймера — глобальный context (или SWR-поллинг `/time-entries/active` раз в 15–30с + локальный тик), чтобы чип в шапке и фокус-режим работали на всех экранах.
4. API-клиент расширить в `lib/api.ts`; контракты — snake_case, типы в `lib/types.ts`.
5. Idle: отслеживать `mousemove/keydown/visibilitychange`; при активном таймере и простое > порога — баннер; «вычесть простой» = stop с `ended_at` = last_activity (нужна поддержка `ended_at` в stop, см. бэкенд).
6. Pomodoro: тикает на клиенте (как сейчас); по завершении фокуса POST `/pomodoro/sessions`, и если включено «записывать в трекер» — POST `/time-entries` с рассчитанными started_at/ended_at.
7. Хоткеи и палитра — глобальный keydown-слушатель в layout.
8. Настройки пользователя (цель дня, порог idle, напоминания, тема) — GET/PATCH `/users/me/settings` (см. бэкенд) + дублировать в localStorage для мгновенного старта.
9. Напоминания — Notification API (запрашивать разрешение при включении чекбокса).

## ТЗ Backend (NestJS + Sequelize, `backend/`)
Все новые контракты — snake_case, JWT-guard как в существующих модулях, Swagger-аннотации.

1. **Модуль `projects`**: модель `projects (id uuid, user_id/workspace_id, name, color, archived boolean default false, timestamps)`. CRUD: `GET/POST /api/projects`, `PATCH /api/projects/:id` (name, color, archived), `DELETE`. У `tasks` новое поле `project_id uuid NULL` (+ в DTO create/update). В `GET /api/tasks` возвращать проект. Записи архивного проекта не удалять.
2. **`time-entries` доработки**: `POST /time-entries/stop` принимает опциональный `ended_at` (для вычета простоя, валидация > started_at); `PATCH /time-entries/:id` (started_at, ended_at, description, task_id) — для инлайн-редактирования; `GET /time-entries/summary?from=&to=` → на каждый день: `total_seconds`, разбивка по `project_id` и `task_id` (для графика недели, streak, heatmap — один запрос вместо 7–14).
3. **Настройки пользователя**: `GET/PATCH /api/users/me/settings` → `daily_goal_hours int default 6, idle_threshold_minutes int default 10, notify_day_start bool, notify_goal_reached bool, theme enum('dark','light')`. Отдельная таблица `user_settings` (1:1 users) или JSONB.
4. **Pomodoro**: в settings добавить `track_to_timer boolean default true` (создание time-entry делает клиент — серверных изменений кроме поля нет).
5. **Модуль `workspaces` (команды)**: `workspaces (id, name, owner_id)`, `workspace_members (workspace_id, user_id, role enum('owner','admin','member'))`, `workspace_invites (id, workspace_id, email, role, token, status enum('pending','revoked','accepted'), created_at)`. Эндпоинты: `POST /api/workspaces`, `GET /api/workspaces/current/members` (с `active_task_title` — join активного time-entry, `today_seconds`, `week_seconds`), `POST /api/workspaces/current/invites`, `DELETE /api/workspaces/current/invites/:id`, `POST /api/invites/:token/accept`. Приглашение по ссылке: `GET /api/workspaces/current/invite-link`. Доступ к данным участников — только чтение агрегатов, роли: member видит список, admin+ приглашает.
6. **Экспорт**: существующий `/api/export/today?date=` оставить; добавить в Summary разбивку по проектам.
7. Схема: сейчас `synchronize:true` — для новых таблиц допустимо, но рекомендуется завести `sequelize-cli` миграции (отмечено в readme репозитория).

## Порядок работ
1) Frontend-оболочка + токены + трекер/задачи на существующем API → 2) projects (BE+FE) → 3) time-entries PATCH/stop ended_at/summary + отчёты, streak, idle → 4) user settings + pomodoro track_to_timer → 5) workspaces/команда → 6) полировка: палитра, хоткеи, фокус-режим, напоминания.

## Файлы в пакете
- `Time Tracker Redesign v2.dc.html` + `support.js` — интерактивный прототип (открыть в браузере)
- `ROADMAP.md` — список фичей
- `screenshots/` — 8 скриншотов: все экраны в тёмной теме + трекер в светлой
