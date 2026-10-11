import { useEffect, useMemo, useState } from "react";
import {
  Link,
  redirect,
  useLoaderData,
  useNavigate,
} from "react-router";

import { api } from "@/lib/api";
import type { Reservation, User } from "@/lib/types";
import { useAuthStore } from "@/store/auth";

/* ---------- Types ---------- */

interface LoaderData {
  user: User;
  reservations: Reservation[];
}

const EMPTY: LoaderData = {
  user: { id: 0, email: "", name: null, phone: null, role: "client", created_at: "" },
  reservations: [],
};

type FilterId = "all" | "upcoming" | "past";

/* ---------- Helpers ---------- */

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function monogram(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "—";
  }
  return (email[0] ?? "—").toUpperCase();
}

function statusLabel(status: string): string {
  switch (status) {
    case "pending_payment":
      return "Ожидает оплаты";
    case "confirmed":
      return "Подтверждено";
    case "cancelled_timeout":
      return "Отменено по таймауту";
    case "cancelled_user":
      return "Отменено вами";
    case "cancelled_admin":
      return "Отменено";
    case "completed":
      return "Завершён";
    default:
      return status;
  }
}

function statusVariant(status: string): "warn" | "ok" | "mute" {
  if (status === "pending_payment") return "warn";
  if (status === "confirmed" || status === "completed") return "ok";
  return "mute";
}

/* ---------- Loader ---------- */

export async function clientLoader() {
  const user = useAuthStore.getState().user;
  if (!user) throw redirect("/login");
  try {
    const reservations = await api.reservations.my();
    return { user, reservations } satisfies LoaderData;
  } catch {
    return { user, reservations: [] } satisfies LoaderData;
  }
}

export function meta() {
  return [{ title: "Личный кабинет — Арт-Кыры" }];
}

export function HydrateFallback() {
  return <p>Загрузка личного кабинета…</p>;
}

/* ---------- Icons ---------- */

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

/* ---------- Sidebar ---------- */

type SectionId = "overview" | "bookings" | "history" | "receipts";

function ProfileSidebar({
  user,
  active,
  onSelect,
  onLogout,
}: {
  user: User;
  active: SectionId;
  onSelect: (id: SectionId) => void;
  onLogout: () => void;
}) {
  const items: { id: SectionId; label: string; trailing?: string }[] = [
    { id: "overview", label: "Обзор кабинета" },
    { id: "bookings", label: "Мои бронирования" },
    { id: "history", label: "История заказов" },
    { id: "receipts", label: "Предоплаты и чеки" },
  ];

  return (
    <aside className="profile-sidebar">
      <div className="profile-user">
        <div className="profile-user__monogram" aria-hidden="true">
          {monogram(user.name, user.email)}
        </div>
        <h2 className="profile-user__name">{user.name ?? user.email}</h2>
        <p className="profile-user__email">{user.email}</p>
        <span className="profile-user__role">КЛИЕНТ АРТ-КЫРЫ</span>
      </div>

      <nav className="profile-nav" aria-label="Разделы кабинета">
        {items.map((it) => (
          <button
            key={it.id}
            type="button"
            className={
              active === it.id
                ? "profile-nav__link profile-nav__link--active"
                : "profile-nav__link"
            }
            onClick={() => onSelect(it.id)}
          >
            {it.label}
          </button>
        ))}
        <button type="button" className="profile-nav__link" onClick={onLogout}>
          Выйти ↗
        </button>
      </nav>

      <hr className="divider-h" />

      <p className="profile-sidebar__hint">
        Новый повод для встречи? Выберите свободный столик на удобную дату.
      </p>

      <Link to="/reserve" className="summary-card__cta summary-card__cta--ghost">
        <span>Новая бронь</span>
        <ArrowUpRight />
      </Link>
    </aside>
  );
}

/* ---------- Page ---------- */

export function ProfilePage() {
  const data = (useLoaderData() as LoaderData | undefined) ?? EMPTY;
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const hydrate = useAuthStore((s) => s.hydrate);
  const storeUser = useAuthStore((s) => s.user);

  const [section, setSection] = useState<SectionId>("overview");
  const [filter, setFilter] = useState<FilterId>("all");
  const [authReady, setAuthReady] = useState(() => useAuthStore.getState().user !== null);

  const [name, setName] = useState(data.user.name ?? "");
  const [phone, setPhone] = useState(data.user.phone ?? "");
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Личный кабинет — Арт-Кыры";
  }, []);

  // Гидрация auth-стора на случай прямого захода на /profile (без редиректа через лоадер).
  // Лоадер уже делает редирект, но эта ветка закрывает состояние «user ещё null, токен в localStorage».
  useEffect(() => {
    if (authReady) return;
    let alive = true;
    (async () => {
      await hydrate();
      if (!alive) return;
      const hydratedUser = useAuthStore.getState().user;
      if (!hydratedUser) {
        navigate("/login", { replace: true });
        return;
      }
      setAuthReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [authReady, hydrate, navigate]);

  // Если лоадер сказал «нет user» и hydrate не помог — редиректим.
  useEffect(() => {
    if (!authReady) return;
    if (!storeUser) navigate("/login", { replace: true });
  }, [authReady, storeUser, navigate]);

  function onLogout() {
    logout();
    navigate("/");
  }

  const current = useMemo(
    () => data.reservations.find((r) => r.status === "pending_payment") ?? null,
    [data.reservations],
  );

  const stats = useMemo(() => {
    const past = data.reservations.filter(
      (r) => r.status === "confirmed" || r.status === "completed",
    );
    const paid = past.reduce((acc, r) => acc + r.deposit_amount, 0);
    return {
      pastCount: past.length,
      paidTotal: paid,
      hasCurrent: data.reservations.some((r) => r.status === "pending_payment") ? 1 : 0,
    };
  }, [data.reservations]);

  const filteredHistory = useMemo(() => {
    const now = Date.now();
    const sorted = [...data.reservations].sort(
      (a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime(),
    );
    if (filter === "upcoming") {
      return sorted.filter((r) => new Date(r.start_time).getTime() >= now);
    }
    if (filter === "past") {
      return sorted.filter((r) => new Date(r.start_time).getTime() < now);
    }
    return sorted;
  }, [data.reservations, filter]);

  // ─── Состояния гейта до рендера основной разметки ───

  if (!authReady) {
    return (
      <div className="gate">
        <div className="gate__card">
          <div className="gate__spinner" aria-hidden="true" />
          <span className="gate__eyebrow">Личный кабинет</span>
          <p className="gate__desc">Проверяем данные профиля…</p>
        </div>
      </div>
    );
  }

  if (!storeUser) {
    // hydrate уже инициировал navigate("/login"); покажем карточку, чтобы не мелькало
    return (
      <div className="gate">
        <div className="gate__card">
          <span className="gate__eyebrow">Личный кабинет</span>
          <h2 className="gate__title">Нужно войти</h2>
          <p className="gate__desc">
            Чтобы открыть кабинет, войдите в аккаунт Арт-Кыры или зарегистрируйтесь.
          </p>
          <div className="gate__actions">
            <Link to="/login" className="btn-cta">
              <span>Войти</span>
              <ArrowUpRight className="btn-cta__icon" />
            </Link>
            <Link
              to="/register"
              className="summary-card__cta summary-card__cta--ghost"
            >
              Создать аккаунт
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="inner-shell">
      <header className="page-header">
        <span className="eyebrow">01 / Минеральный · Ваш визит</span>
        <h1 className="display page-header__title">
          Рады видеть вас, {data.user.name ?? data.user.email}
        </h1>
        <p className="muted" style={{ maxWidth: 640 }}>
          Ваши встречи, любимые места и история визитов — всё здесь.
        </p>
      </header>

      <div className="profile-grid">
        <ProfileSidebar
          user={data.user}
          active={section}
          onSelect={setSection}
          onLogout={onLogout}
        />

        <div className="profile-main">
          {/* Profile edit */}
          {section === "overview" && (
            <section className="panel profile-edit" aria-label="Мой профиль">
              <div className="panel__head">
                <h2 className="panel__title">Мой профиль</h2>
                <span className="panel__hint">Личные данные</span>
              </div>

              <div className="profile-edit__row">
                <div className="form-row" style={{ flex: 1 }}>
                  <label className="form-row__label" htmlFor="profile-name">Имя и фамилия</label>
                  <input
                    id="profile-name"
                    className="form-row__input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="form-row" style={{ flex: 1 }}>
                  <label className="form-row__label" htmlFor="profile-phone">Телефон</label>
                  <input
                    id="profile-phone"
                    className="form-row__input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+7 (___) ___-__-__"
                  />
                </div>
                <div className="form-row" style={{ flex: 1 }}>
                  <label className="form-row__label" htmlFor="profile-email">Электронная почта</label>
                  <input
                    id="profile-email"
                    className="form-row__input"
                    type="email"
                    value={data.user.email}
                    readOnly
                  />
                </div>
              </div>

              <div className="profile-edit__save">
                <button
                  type="button"
                  className="summary-card__cta summary-card__cta--ghost"
                  style={{ width: "auto", padding: "0 28px" }}
                  onClick={() => setSavedAt(new Date().toLocaleTimeString("ru-RU"))}
                >
                  <span>Сохранить изменения</span>
                </button>
                {savedAt && (
                  <span className="profile-edit__status">
                    Изменения сохранены в {savedAt}
                  </span>
                )}
                <span className="profile-edit__save-hint">
                  Контакты используются для подтверждений брони и информации об оплате.
                </span>
              </div>
            </section>
          )}

          {/* Current reservation */}
          {section === "overview" && current && (
            <section className="panel panel--accent-border" aria-label="Текущая бронь">
              <div className="panel__head">
                <h2 className="panel__title">Текущая бронь</h2>
                <span className={`status-pill status-pill--${statusVariant(current.status)}`}>
                  <span className="status-pill__dot" />
                  {statusLabel(current.status)}
                </span>
              </div>

              <div className="current-res">
                <div className="current-res__params">
                  <div className="payment-summary__param">
                    <dt>Дата</dt>
                    <dd><b>{formatDateLong(current.start_time)}</b></dd>
                  </div>
                  <div className="payment-summary__param">
                    <dt>Время</dt>
                    <dd><b>{formatTime(current.start_time)} — {formatTime(current.end_time)}</b></dd>
                  </div>
                  <div className="payment-summary__param">
                    <dt>Стол</dt>
                    <dd><b>№ {current.table_id}</b></dd>
                  </div>
                  <div className="payment-summary__param">
                    <dt>Гости</dt>
                    <dd><b>{current.guests_count}</b></dd>
                  </div>
                </div>

                <aside className="current-res__aside">
                  <span className="current-res__aside-title">Обязательная предоплата</span>
                  <span className="current-res__aside-amount">
                    {current.deposit_amount.toLocaleString("ru-RU")} ₽
                  </span>
                  <div className="current-res__aside-row">
                    <span>Удержание до</span>
                    <b>{formatTime(current.hold_expires_at ?? current.start_time)}</b>
                  </div>
                  <Link to={`/payment/${current.id}`} className="payment-cta">
                    <span>Оплатить предоплату</span>
                    <ArrowUpRight />
                  </Link>
                </aside>
              </div>

              <hr className="divider-h" />

              <p className="current-res__hint">
                Стол удерживается 15 минут. Успешная оплата подтверждает бронь; неоплата за 15
                минут отменяет её. Предоплата учитывается в счёте, но не является полной
                стоимостью заказа.
              </p>
            </section>
          )}

          {/* Stats */}
          {section === "overview" && (
            <div className="stats-row">
              <div className="stat-card">
                <span className="stat-card__value">{String(stats.pastCount).padStart(2, "0")}</span>
                <span className="stat-card__label">Состоявшихся визита</span>
              </div>
              <div className="stat-card">
                <span className="stat-card__value">
                  {stats.paidTotal.toLocaleString("ru-RU")} ₽
                </span>
                <span className="stat-card__label">Оплачено предоплат</span>
              </div>
              <div className="stat-card">
                <span className="stat-card__value">{String(stats.hasCurrent).padStart(2, "0")}</span>
                <span className="stat-card__label">Текущая бронь</span>
              </div>
            </div>
          )}

          {/* Bookings only (alternate view) */}
          {section === "bookings" && (
            <section className="panel">
              <h2 className="panel__title">Мои бронирования</h2>
              {data.reservations.length === 0 ? (
                <p className="empty">Пока нет бронирований.</p>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                  {data.reservations.map((r) => (
                    <li
                      key={r.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: 16,
                        border: "1px solid var(--art-kyry-divider)",
                        borderRadius: 4,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 500 }}>
                          Стол № {r.table_id} · {formatDateShort(r.start_time)} · {formatTime(r.start_time)}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--art-kyry-ink-muted)" }}>
                          Гостей: {r.guests_count} · {r.deposit_amount.toLocaleString("ru-RU")} ₽
                        </div>
                      </div>
                      <span className={`status-pill status-pill--${statusVariant(r.status)}`}>
                        <span className="status-pill__dot" />
                        {statusLabel(r.status)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* Receipts only */}
          {section === "receipts" && (
            <section className="panel">
              <h2 className="panel__title">Предоплаты и чеки</h2>
              <p className="panel__hint">
                Здесь появятся предоплаты и закрывающие чеки по вашим визитам.
              </p>
            </section>
          )}

          {/* History (overview or history tab) */}
          {(section === "overview" || section === "history") && (
            <section className="history" aria-label="История визитов и заказов">
              <div className="history__head">
                <h2 className="history__title">История визитов и заказов</h2>
                <span className="history__count">
                  {data.reservations.length}{" "}
                  {data.reservations.length === 1 ? "запись" : "записей"}
                </span>
              </div>

              <div className="history__filters">
                {([
                  { id: "all", label: "Все" },
                  { id: "upcoming", label: "Предстоящие" },
                  { id: "past", label: "Завершённые" },
                ] as { id: FilterId; label: string }[]).map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    className={
                      filter === it.id
                        ? "history__filter history__filter--active"
                        : "history__filter"
                    }
                    onClick={() => setFilter(it.id)}
                  >
                    {it.label}
                  </button>
                ))}
              </div>

              <div className="history__list">
                <div className="history__list-head">
                  <span>Дата и время</span>
                  <span>Стол</span>
                  <span>Гости</span>
                  <span>Статус</span>
                  <span>Оплата предоплаты</span>
                </div>
                {filteredHistory.length === 0 ? (
                  <div style={{ padding: 24, textAlign: "center", color: "var(--art-kyry-ink-muted)" }}>
                    Пока нет записей под выбранный фильтр.
                  </div>
                ) : (
                  filteredHistory.map((r) => {
                    const variant = statusVariant(r.status);
                    return (
                        <div key={r.id} className="history__row">
                          <span>
                            <b>{formatDateLong(r.start_time)}</b>
                            <div className="muted-cell">{formatTime(r.start_time)}</div>
                          </span>
                          <span>№ {r.table_id}</span>
                          <span>{r.guests_count}</span>
                          <span>
                            <span className={`status-pill status-pill--${variant}`}>
                              <span className="status-pill__dot" />
                              {statusLabel(r.status)}
                            </span>
                          </span>
                          <span>
                            <b>{r.deposit_amount.toLocaleString("ru-RU")} ₽</b>
                            <div className="muted-cell">
                              {r.status === "confirmed" || r.status === "completed"
                                ? "Оплачено"
                                : r.status === "pending_payment"
                                ? "Ожидает"
                                : "—"}
                            </div>
                          </span>
                        </div>
                      );
                  })
                )}
              </div>

              <p className="history__footnote">
                В колонке «Оплата предоплаты» показан платёж для подтверждения брони, а не оплата
                полного ресторанного счёта.
              </p>
            </section>
          )}

          {/* History-only placeholder */}
          {section === "history" && filteredHistory.length === 0 && (
            <p className="empty" style={{ marginTop: -16 }}>
              Отфильтруйте записи или загляните позже.
            </p>
          )}
        </div>
      </div>

      <div className="help-strip">
        <span className="help-strip__desc">
          Не нашли подходящий столик? Откройте карту зала и выберите другое время.
        </span>
        <Link to="/reserve" className="help-strip__cta">
          Перейти к бронированию ↗
        </Link>
      </div>
    </div>
  );
}