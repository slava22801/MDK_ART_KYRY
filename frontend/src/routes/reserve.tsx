import { useEffect, useMemo, useState } from "react";
import {
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useNavigate,
} from "react-router";

import { api } from "@/lib/api";
import type { Table } from "@/lib/types";
import { useAuthStore } from "@/store/auth";

/* ---------- Types ---------- */

interface LoaderData {
  tables: Table[];
  startTime: string;
  guests: number;
}

type HallTableState = "free" | "busy" | "selected";

interface HallTable {
  number: number;
  seats: 2 | 4;
  state: HallTableState;
  x: number; // percentage from left
  y: number; // percentage from top
}

const HALL_TABLES: HallTable[] = [
  // Top row
  { number: 1, seats: 2, state: "free",     x: 7.5,  y: 13 },
  { number: 4, seats: 2, state: "busy",     x: 38.5, y: 13 },
  { number: 7, seats: 2, state: "selected", x: 69.5, y: 13 },
  // Middle row
  { number: 2, seats: 4, state: "free",     x: 7.5,  y: 42 },
  { number: 5, seats: 4, state: "busy",     x: 38.5, y: 42 },
  { number: 8, seats: 2, state: "free",     x: 69.5, y: 42 },
  // Bottom row
  { number: 3, seats: 4, state: "free",     x: 7.5,  y: 69 },
  { number: 6, seats: 4, state: "busy",     x: 52.5, y: 69 },
  { number: 9, seats: 2, state: "free",     x: 69.5, y: 69 },
];

const SESSION_TIMES = ["18:00", "18:30", "19:00", "19:30", "20:00", "20:30"];

function toIsoLocal(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

function nowPlusHour(): { date: string; time: string } {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  return {
    date: d.toISOString().slice(0, 10),
    time: d.toTimeString().slice(0, 5),
  };
}

function formatDateLong(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return d.toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatDateShort(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatTime(time: string): string {
  return time;
}

/* ---------- Loader / Action ---------- */

export async function clientLoader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  const time = url.searchParams.get("time");
  const guests = Number(url.searchParams.get("guests") ?? 2);

  if (!date || !time) return { tables: [], startTime: "", guests };

  const iso = toIsoLocal(date, time);
  try {
    const tables = await api.tables.availability({ start_time: iso, guests_count: guests });
    return { tables, startTime: iso, guests } satisfies LoaderData;
  } catch {
    return { tables: [], startTime: iso, guests } satisfies LoaderData;
  }
}

export async function clientAction({ request }: { request: Request }) {
  const form = await request.formData();
  const tableId = Number(form.get("table_id"));
  const startTime = String(form.get("start_time"));
  const guests = Number(form.get("guests_count"));

  if (!tableId || !startTime || !guests) {
    return { error: "Заполните все поля" };
  }
  try {
    const result = await api.reservations.create({
      table_id: tableId,
      start_time: startTime,
      guests_count: guests,
    });
    return redirect(`/payment/${result.id}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Не удалось создать бронь";
    return { error: message };
  }
}

/* ---------- Meta ---------- */

export function meta() {
  return [{ title: "Бронирование — Арт-Кыры" }];
}

export function HydrateFallback() {
  return <p>Загрузка…</p>;
}

/* ---------- Icons ---------- */

function Chevron({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function ArrowUpRight({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      width="14"
      height="14"
    >
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 1 1 8 0v3" />
    </svg>
  );
}

function UpArrow() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      width="13"
      height="13"
    >
      <path d="M12 19V5" />
      <path d="m6 11 6-6 6 6" />
    </svg>
  );
}

/* ---------- Hall table ---------- */

function HallTableView({
  table,
  onSelect,
}: {
  table: HallTable;
  onSelect: (n: number) => void;
}) {
  const surfaceClass =
    table.state === "selected"
      ? "hall-map__table-surface hall-map__table-surface--selected"
      : table.state === "busy"
      ? "hall-map__table-surface hall-map__table-surface--busy"
      : "hall-map__table-surface";

  const seatPositions = useMemo<string[]>(() => {
    const two = ["hall-map__seat--top-left", "hall-map__seat--top-right"];
    const four = [
      "hall-map__seat--top-left",
      "hall-map__seat--top-right",
      "hall-map__seat--bot-left",
      "hall-map__seat--bot-right",
    ];
    return table.seats === 2 ? two : four;
  }, [table.seats]);

  return (
    <button
      type="button"
      className="hall-map__table"
      style={{ left: `${table.x}%`, top: `${table.y}%` }}
      disabled={table.state === "busy"}
      onClick={() => table.state === "free" && onSelect(table.number)}
      aria-label={`Стол ${table.number}, ${table.state === "busy" ? "занят" : "свободен"}`}
    >
      {seatPositions.map((cls, i) => (
        <span key={i} className={`hall-map__seat ${cls}`} />
      ))}
      <span className={surfaceClass}>{table.number}</span>
      {table.state === "busy" && <span className="hall-map__busy-tag">Занят</span>}
    </button>
  );
}

/* ---------- Page ---------- */

export function ReservePage() {
  const initial = nowPlusHour();
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [guests, setGuests] = useState(2);
  const [activeSession, setActiveSession] = useState(time);

  const loaderData = (useLoaderData() as LoaderData | undefined) ?? {
    tables: [],
    startTime: "",
    guests: 2,
  };
  const actionData = useActionData() as { error?: string } | undefined;

  useEffect(() => {
    document.title = "Бронирование — Арт-Кыры";
  }, []);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams({ date, time, guests: String(guests) });
    navigate(`/reserve?${params}`);
  }

  function pickSession(t: string) {
    setActiveSession(t);
    setTime(t);
  }

  // Real available tables from API (if any); fall back to the mock hall
  const tablesByNumber: Record<number, HallTableState> = useMemo(() => {
    const map: Record<number, HallTableState> = {};
    HALL_TABLES.forEach((t) => (map[t.number] = t.state));
    if (loaderData.tables.length > 0) {
      // Mark all mock tables busy unless explicitly listed as available
      Object.keys(map).forEach((k) => (map[Number(k)] = "busy"));
      loaderData.tables.forEach((t) => {
        const n = Number(t.number);
        if (n in map) map[n] = "free";
      });
    }
    return map;
  }, [loaderData.tables]);

  // Default "selected" = first free table, mirroring the design's № 7
  const selectedNumber = useMemo(() => {
    const selected = HALL_TABLES.find((t) => t.state === "selected");
    return selected?.number ?? 4; // table #4 is the cap
  }, []);
  const selectedTable = HALL_TABLES.find((t) => t.number === selectedNumber);

  const deposit = 1500 * guests;

  if (!user) {
    return (
      <div className="inner-shell">
        <header className="page-header">
          <span className="eyebrow">01 / Минеральный · Ваш визит</span>
          <h1 className="display page-header__title">Выберите свой столик</h1>
          <p className="muted">
            Чтобы продолжить, войдите или создайте аккаунт — выбор столика сохранится.
          </p>
        </header>
        <div style={{ display: "flex", gap: 16 }}>
          <Link to="/login" className="btn-cta">
            <span>Войти</span>
            <ArrowUpRight className="btn-cta__icon" />
          </Link>
          <Link to="/register" className="summary-card__cta summary-card__cta--ghost">
            Создать аккаунт
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="inner-shell">
      <header className="page-header">
        <span className="eyebrow">01 / Минеральный · Ваш визит</span>
        <h1 className="display page-header__title">Выберите свой столик</h1>
        <p className="muted" style={{ maxWidth: 640 }}>
          {formatDateLong(date)} · Посмотрите доступность и спланируйте вечер в Арт-Кыры.
        </p>
        <div className="steps" aria-label="Этапы бронирования">
          <div className="step">
            <span className="step__dot step__dot--active">1</span>
            <span className="step__label step__label--active">Выбор столика</span>
          </div>
          <div className="step">
            <span className="step__dot">2</span>
            <span className="step__label">Предоплата</span>
          </div>
          <div className="step">
            <span className="step__dot">3</span>
            <span className="step__label">Подтверждение</span>
          </div>
        </div>
      </header>

      <div className="reserve-grid">
        {/* LEFT: Settings */}
        <aside className="reserve-settings">
          <h2 className="reserve-settings__title">Ваш визит</h2>

          <form className="reserve-field-group" onSubmit={onSearch}>
            <div className="reserve-field">
              <label className="reserve-field__label" htmlFor="reserve-date">Дата визита</label>
              <div className="reserve-field__input">
                <input
                  id="reserve-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
                <Chevron className="reserve-field__chevron" />
              </div>
            </div>

            <div className="reserve-field">
              <label className="reserve-field__label" htmlFor="reserve-time">Время начала</label>
              <div className="reserve-field__input">
                <input
                  id="reserve-time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                />
                <Chevron className="reserve-field__chevron" />
              </div>
            </div>

            <div className="reserve-field">
              <label className="reserve-field__label" htmlFor="reserve-guests">Количество гостей</label>
              <div className="reserve-field__input">
                <input
                  id="reserve-guests"
                  type="number"
                  min={1}
                  max={20}
                  value={guests}
                  onChange={(e) => setGuests(Number(e.target.value))}
                  required
                />
                <Chevron className="reserve-field__chevron" />
              </div>
            </div>
          </form>

          <hr className="divider-h" />

          <div className="sessions-block">
            <span className="sessions-block__title">Другие сеансы</span>
            <div className="sessions-block__chips">
              {SESSION_TIMES.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={
                    activeSession === t
                      ? "session-chip session-chip--active"
                      : "session-chip"
                  }
                  onClick={() => pickSession(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <p className="reserve-note">
            Продолжительность визита — 2 часа. Для компаний от 7 гостей свяжитесь с нами по телефону.
          </p>
          <a href="tel:+74950000000" className="reserve-phone">
            +7 (495) 000-00-00
          </a>
        </aside>

        {/* CENTER: Hall map */}
        <section className="hall-map" aria-label="Схема зала">
          <div className="hall-map__head">
            <h2 className="hall-map__title">Основной зал</h2>
            <span className="hall-map__count">
              {Object.values(tablesByNumber).filter((s) => s === "free").length} свободных
              столиков
            </span>
          </div>

          <div className="hall-map__canvas">
            <div className="hall-map__windows">
              <span className="hall-map__window-bar" />
              <span>ПАНОРАМНЫЕ ОКНА</span>
              <span className="hall-map__window-bar" />
            </div>

            <div className="hall-map__tables">
              {HALL_TABLES.map((t) => (
                <HallTableView
                  key={t.number}
                  table={{ ...t, state: tablesByNumber[t.number] ?? t.state }}
                  onSelect={() => undefined}
                />
              ))}
            </div>

            <div className="hall-map__entry">
              <UpArrow />
              <span>ВХОД</span>
            </div>
            <span className="hall-map__bar-tag">БАР</span>
            <span className="hall-map__schema-tag">Схема условная</span>
          </div>

          <div className="hall-map__legend">
            <div className="legend-item">
              <span className="legend-item__swatch" />
              <span>Свободен</span>
            </div>
            <div className="legend-item">
              <span className="legend-item__swatch legend-item__swatch--busy" />
              <span>Занят</span>
            </div>
            <div className="legend-item">
              <span className="legend-item__swatch legend-item__swatch--selected" />
              <span>Выбран</span>
            </div>
          </div>

          <hr className="divider-h" />

          <p className="hall-map__hint">
            Выбран стол № {selectedNumber} на {guests}{" "}
            {guests === 1 ? "гостя" : guests < 5 ? "гостей" : "гостей"}. Занятые столики
            недоступны для выбора; пересекающиеся бронирования не допускаются.
          </p>
        </section>

        {/* RIGHT: Summary */}
        <aside className="reserve-summary">
          <article className="summary-card">
            <span className="summary-card__title">Ваш вечер</span>
            <h3 className="summary-card__heading">Столик № {selectedNumber}</h3>
            <p className="summary-card__desc">
              {selectedTable?.seats === 2
                ? "У панорамного окна. Тихая зона основного зала, мягкие кресла."
                : "В центре зала. Подходит для компании или семейного ужина."}{" "}
              Вместимость — {selectedTable?.seats ?? 2}{" "}
              {(selectedTable?.seats ?? 2) < 5
                ? (selectedTable?.seats ?? 2) === 2
                  ? "гостя"
                  : "гостя"
                : "гостей"}
              .
            </p>

            <hr className="divider-h" />

            <dl className="summary-card__params">
              <div className="summary-card__param">
                <dt>Дата</dt>
                <dd><b>{formatDateShort(date)}</b></dd>
              </div>
              <div className="summary-card__param">
                <dt>Время</dt>
                <dd><b>{formatTime(time)}</b></dd>
              </div>
              <div className="summary-card__param">
                <dt>Стол</dt>
                <dd><b>№ {selectedNumber}</b></dd>
              </div>
              <div className="summary-card__param">
                <dt>Гости</dt>
                <dd><b>{guests}</b></dd>
              </div>
            </dl>

            <hr className="divider-h" />

            <div className="summary-card__deposit">
              <span className="summary-card__deposit-label">Обязательная предоплата</span>
              <span className="summary-card__deposit-amount">
                {deposit.toLocaleString("ru-RU")} ₽
              </span>
              <span className="summary-card__deposit-note">
                1 500 ₽ × {guests}{" "}
                {guests === 1 ? "гость" : guests < 5 ? "гостя" : "гостей"}. Учитывается в счёте
                за визит, это не полная стоимость заказа.
              </span>
            </div>

            <div className="summary-card__login">
              <div className="summary-card__login-row">
                <LockIcon />
                <span>Авторизация необходима</span>
              </div>
              <p className="summary-card__login-text">
                Смотреть доступность можно без входа. Вы вошли как {user.name ?? user.email}.
              </p>
              <Link to="/login" className="summary-card__login-link">
                Сменить аккаунт ↗
              </Link>
            </div>

            <Form method="post" className="summary-card__cta-wrap">
              <input type="hidden" name="table_id" value={selectedNumber} />
              <input
                type="hidden"
                name="start_time"
                value={loaderData.startTime || toIsoLocal(date, time)}
              />
              <input type="hidden" name="guests_count" value={guests} />
              <button type="submit" className="summary-card__cta">
                <span>Войти и продолжить</span>
                <ArrowUpRight />
              </button>
            </Form>

            {actionData?.error && (
              <p className="error" style={{ margin: 0 }}>{actionData.error}</p>
            )}

            <p className="summary-card__hint">
              Далее — обязательная предоплата. Стол пока не удерживается; доступность проверяется
              снова после входа.
            </p>
          </article>
        </aside>
      </div>

      <div className="help-strip">
        <div className="help-strip__copy">
          <span className="help-strip__title">Планируете особенный вечер?</span>
          <span className="help-strip__desc">
            Расскажите об аллергиях, детском стуле или поводе для встречи — мы поможем подготовить
            ваш визит.
          </span>
        </div>
        <a href="tel:+74950000000" className="help-strip__cta">
          Связаться с рестораном ↗
        </a>
      </div>
    </div>
  );
}