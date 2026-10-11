# Арт-Кыры — ресторан

Fullstack веб-приложение ресторана: меню, бронирование столиков с предоплатой, личный кабинет, админ-панель.

## Стек

| Слой | Технология |
|---|---|
| Frontend | React 18, React Router v7 (client loaders/actions), Zustand, Vite, TypeScript |
| Backend | FastAPI, SQLAlchemy 2 (async), Pydantic v2, APScheduler |
| Database | PostgreSQL 15 (`btree_gist` + `EXCLUDE USING gist` для защиты от овербукинга) |
| Storage | MinIO (S3-совместимое) для фотографий блюд |
| Cache / queue | Redis |
| Reverse proxy | nginx |
| Orchestration | Docker Compose |

## Структура репозитория

```
MDK_ART-KYRY/
├── backend/                  FastAPI приложение
│   ├── app/                  Код (main, core, db, models, schemas, services, api)
│   ├── alembic/              Миграции (env.py + versions/0001_initial.py)
│   ├── tests/                Интеграционные тесты (pytest)
│   ├── Dockerfile
│   ├── requirements.txt
│   └── pytest.ini
├── frontend/                 React SPA
│   ├── src/
│   │   ├── routes/           Публичные страницы
│   │   ├── routes/admin/     Админ-панель
│   │   ├── components/       UI-блоки
│   │   ├── store/            Zustand
│   │   └── lib/              api-клиент, типы, http
│   ├── Dockerfile (multi-stage: node build → nginx)
│   └── nginx.conf            SPA fallback
├── nginx/                    Reverse proxy (frontend + backend)
├── docker-compose.yml        Все сервисы
├── .env.example              Шаблон переменных окружения
└── README.md
```

## Роли и учётные записи

| Роль | Возможности |
|---|---|
| **Гость** | Главная, меню, контакты, проверка доступных столов |
| **Клиент** | Регистрация/вход, бронирование стола, оплата, история броней, отмена, редактирование профиля |
| **Админ** | Управление столами, бронированиями, меню, загрузка фото, статистика |

После сида доступны:
- **Admin:** `admin@art-kyry.local` / `admin12345`
- **Клиент:** `client@art-kyry.local` / `client12345`

## Быстрый старт (Docker Compose)

```bash
# 1. Копируем переменные окружения
cp .env.example .env

# 2. Запускаем всё (кроме seed)
docker compose up --build -d
```

**Если образ MinIO не пулится** (`pull access denied for minio/minio`) — Docker Hub заблокирован. В `docker-compose.yml` используется зеркало `dappros/minio`, но при наличии доступа до Docker Hub можно поставить оригинал:
```bash
echo "MINIO_IMAGE=minio/minio:latest" >> .env
```

# 3. Применяем миграции
docker compose exec backend alembic upgrade head

# 4. Заполняем БД (admin, столы, меню)
docker compose --profile seed up seed

# 5. Открываем
# Сайт:          http://localhost
# API docs:      http://localhost/api/docs
# MinIO API:     http://localhost:9090
# MinIO console: http://localhost:9091 (логин/пароль из .env)

> Если порты 9090/9091 заняты, измените `MINIO_API_PORT` и `MINIO_CONSOLE_PORT` в `.env`. Внутри docker-network MinIO всегда доступен на 9000/9001 (`S3_ENDPOINT=http://minio:9000`), менять `S3_ENDPOINT` не нужно.
```

## Ключевые фичи

### Бронирование с предоплатой (core)
1. Клиент выбирает дату+время+гостей → `GET /api/v1/tables/availability`
2. Выбирает стол → `POST /api/v1/reservations` создаёт бронь `pending_payment` с удержанием стола 15 минут, выдаёт `payment_url`
3. Клиент оплачивает → вебхук `POST /api/v1/webhooks/payment` переводит бронь в `confirmed`
4. Если за 15 минут не оплачено — APScheduler переводит в `cancelled_timeout` и стол снова доступен

### Защита от овербукинга (уровень БД)
В миграции `0001_initial.py` создан генерируемый столбец `time_range tstzrange` и `EXCLUDE`-ограничение:
```sql
ALTER TABLE reservations ADD CONSTRAINT ex_reservations_no_overlap
EXCLUDE USING gist (
    table_id WITH =,
    time_range WITH &&
) WHERE (status IN ('pending_payment', 'confirmed'))
```
Любая попытка вставить пересекающуюся бронь ловится в Python как `IntegrityError` → `409 Conflict`.

### Фоновые задачи
`AsyncIOScheduler` в lifespan `app.main` запускает `cancel_expired_pending` каждые 30 секунд.

## API endpoints

### Auth
| Метод | Путь | Описание |
|---|---|---|
| `POST` | `/api/v1/auth/register` | Регистрация |
| `POST` | `/api/v1/auth/login` | Логин |
| `GET`  | `/api/v1/auth/me` | Текущий пользователь |

### Tables
| Метод | Путь | Описание |
|---|---|---|
| `GET`  | `/api/v1/tables` | Список активных столов |
| `GET`  | `/api/v1/tables/availability` | Свободные столы (`start_time`, `guests_count`) |
| `GET`  | `/api/v1/tables/admin/tables/all` | Все столы (admin) |
| `POST` | `/api/v1/tables/admin/tables` | Создать стол (admin) |
| `PATCH`| `/api/v1/tables/admin/tables/{id}` | Изменить стол (admin) |
| `DELETE`| `/api/v1/tables/admin/tables/{id}` | Удалить стол (admin) |

### Reservations
| Метод | Путь | Описание |
|---|---|---|
| `POST` | `/api/v1/reservations` | Создать бронь, вернёт `payment_url` (auth) |
| `GET`  | `/api/v1/reservations/me` | История (auth) |
| `GET`  | `/api/v1/reservations/{id}` | Одна бронь (owner/admin) |
| `POST` | `/api/v1/reservations/{id}/cancel` | Отмена (owner) |
| `GET`  | `/api/v1/reservations/admin/reservations` | Все брони (admin) |
| `PATCH`| `/api/v1/reservations/admin/reservations/{id}` | Сменить статус (admin) |

### Menu
| Метод | Путь | Описание |
|---|---|---|
| `GET`  | `/api/v1/menu` | Категории + блюда (публичный) |
| `POST` | `/api/v1/menu/admin/menu/categories` | Создать категорию |
| `PATCH`| `/api/v1/menu/admin/menu/categories/{id}` | Изменить категорию |
| `DELETE`| `/api/v1/menu/admin/menu/categories/{id}` | Удалить категорию |
| `POST` | `/api/v1/menu/admin/menu/items` | Создать блюдо |
| `PATCH`| `/api/v1/menu/admin/menu/items/{id}` | Изменить блюдо |
| `DELETE`| `/api/v1/menu/admin/menu/items/{id}` | Удалить блюдо |
| `POST` | `/api/v1/menu/admin/menu/upload-image` | Загрузить фото (multipart) → возвращает `image_url` |

### Webhooks / Dev
| Метод | Путь | Описание |
|---|---|---|
| `POST` | `/api/v1/webhooks/payment` | Webhook от платёжного шлюза |
| `POST` | `/api/v1/dev/payment/{id}/confirm` | Имитация оплаты (только при `PAYMENT_PROVIDER=stub`) |

### Admin dashboard
| Метод | Путь | Описание |
|---|---|---|
| `GET` | `/api/v1/admin/stats` | Статистика: подтверждённые/ожидающие/отмены за день, выручка, предстоящие |

## Переменные окружения

Полный список в `.env.example`. Основные:

| Переменная | Назначение | По умолчанию |
|---|---|---|
| `POSTGRES_USER/PASSWORD/DB` | Креды БД | `art_kyry/art_kyry_pass/art_kyry` |
| `MINIO_ROOT_USER/PASSWORD` | Креды MinIO | `minio_admin/minio_admin_pass` |
| `JWT_SECRET` | Секрет подписи JWT | **обязательно сменить** |
| `PAYMENT_WEBHOOK_SECRET` | Секрет проверки вебхуков | **обязательно сменить** |
| `PAYMENT_PROVIDER` | `stub` / `stripe` / `yukassa` / `tinkoff` | `stub` |
| `DEPOSIT_AMOUNT` | Сумма предоплаты, ₽ | `500` |
| `RESERVATION_HOLD_MIN` | Сколько минут удерживать стол | `15` |
| `RESERVATION_DEFAULT_DURATION_MIN` | Длительность слота брони | `120` |
| `SEED_ADMIN_EMAIL/PASSWORD` | Креды админа при сиде | `admin@art-kyry.local/admin12345` |
| `SEED_TEST_CLIENT_EMAIL/PASSWORD` | Креды тестового клиента | `client@art-kyry.local/client12345` |
| `FRONTEND_BASE_URL` | Базовый URL фронта (для `payment_url`) | `http://localhost` |

## Сценарий проверки end-to-end

1. Открыть `http://localhost`, перейти на `/register`, зарегистрировать клиента
2. Залогиниться → `/reserve`, выбрать дату/время/гостей, выбрать стол
3. На `/payment/{id}` нажать «Подтвердить оплату (stub)» → статус → `confirmed`
4. В `/profile` видна подтверждённая бронь
5. Залогиниться как `admin@art-kyry.local` → `/admin` (дашборд), `/admin/tables`, `/admin/reservations`, `/admin/menu`

## Тестирование

### Запуск интеграционных тестов

Тесты требуют Postgres с `btree_gist`. Самый простой способ — поднять его через compose:

```bash
# 1. Если на хосте 5432 занят (другими Postgres-ами), задайте DB_HOST_PORT в .env
echo "DB_HOST_PORT=54329" >> .env

# 2. Запустите только сервис db
docker compose up -d db

# 3. Создайте тестовую БД (однократно)
docker exec mdk_art_kyry_db psql -U art_kyry -d art_kyry -c "CREATE DATABASE art_kyry_test;"

# 4. Запустите тесты
cd backend
TEST_DATABASE_URL=postgresql+asyncpg://art_kyry:art_kyry_pass@localhost:54329/art_kyry_test \
  python -m pytest -v
```

Технические детали тестов:
- Engine использует `NullPool` — каждое соединение свежее, нет проблем с переиспользованием
- `event_loop` фикстура — session-scoped, чтобы избежать проблем asyncpg с разными loop'ами
- Схема создаётся через `create_all` + `EXCLUDE` constraint (без Alembic, чтобы тесты не зависели от миграций)
- Перед каждым тестом — `TRUNCATE ... RESTART IDENTITY CASCADE`
- HTTP-вызовы идут через `httpx.AsyncClient` с `ASGITransport` (in-process, без сети)

### Покрытые сценарии

| Файл | Что проверяет |
|---|---|
| `test_auth.py` | Регистрация, логин, дубликаты email, валидация пароля, `/me` с токеном и без |
| `test_reservations.py` | Availability, создание с удержанием, защита от овербукинга (409), частичное пересечение, оплата через webhook, идемпотентность, stub-confirm, отмена пользователем, права доступа, автотаймаут через `cancel_expired_pending` |
| `test_tables_admin.py` | CRUD столов админом, права клиента, дубликаты номеров |
| `test_menu_admin.py` | CRUD категорий и блюд, невозможность удалить категорию с блюдами, права доступа |
| `test_admin_stats.py` | Подсчёт подтверждённых/ожидающих/таймаутов, выручка, фильтрация по дате |

### Пропуск отдельных групп

```bash
pytest -m "not slow"                          # пропустить медленные
pytest tests/test_reservations.py             # только одно
pytest -k "overbooking"                       # по подстроке в имени
```

## Разработка без Docker

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Запустить локальный Postgres (например через brew services) и MinIO
export DATABASE_URL=postgresql+asyncpg://art_kyry:art_kyry_pass@localhost:5432/art_kyry
export REDIS_URL=redis://localhost:6379/0
export JWT_SECRET=devsecret
export S3_ENDPOINT=http://localhost:9000
export S3_ACCESS_KEY=minio_admin
export S3_SECRET_KEY=minio_admin_pass
export S3_BUCKET=art-kyry-media
export PAYMENT_WEBHOOK_SECRET=devsecret

alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
VITE_API_BASE_URL=http://localhost:8000/api/v1 \
  VITE_API_PROXY_TARGET=http://localhost:8000 \
  npm run dev
```

## Безопасность

- JWT (HS256) с TTL 60 минут
- Пароли — **argon2** через passlib (победитель Password Hashing Competition, без 72-байтного лимита bcrypt)
- CORS — настраивается через `CORS_ORIGINS` (пока дефолт для localhost)
- Все админские эндпоинты защищены через `require_admin`
- Файлы в MinIO загружаются с `ACL: public-read` (для простоты; в проде — приватный bucket + presigned URLs на чтение)
- Подпись вебхуков от провайдера проверяется (для stub — пропускается)

## Что осталось / TODO

- Реализация платежей для Stripe / ЮKassa / Tinkoff (сейчас только stub)
- E-mail уведомления клиенту при подтверждении/отмене
- CI (GitHub Actions) — линтер + тесты
- HTTPS в compose + Let's Encrypt
- Rate limiting на эндпоинты авторизации
- Бронирование с повторяющимися интервалами (по дням недели)