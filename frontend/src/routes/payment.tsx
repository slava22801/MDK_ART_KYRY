import { useEffect, useMemo, useState } from "react";
import {
  Form,
  Link,
  redirect,
  useLoaderData,
  useRevalidator,
} from "react-router";

import { api } from "@/lib/api";
import type { Reservation } from "@/lib/types";
import { useAuthStore } from "@/store/auth";

/* ---------- Types / helpers ---------- */

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatDateTime(iso: string): string {
  return `${formatDateShort(iso)} · ${formatTime(iso)}`;
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
      return "Отменено администратором";
    case "completed":
      return "Визит состоялся";
    default:
      return status;
  }
}

function statusVariant(status: string): "warn" | "ok" | "mute" {
  if (status === "pending_payment") return "warn";
  if (status === "confirmed" || status === "completed") return "ok";
  return "mute";
}

/* ---------- Loader / Action ---------- */

export async function clientLoader({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!id) throw redirect("/reserve");
  try {
    const reservation = await api.reservations.get(id);
    return { reservation };
  } catch {
    throw new Response("not found", { status: 404 });
  }
}

export async function clientAction({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  await api.reservations.devConfirmPayment(id);
  return redirect(`/payment/${id}?paid=1`);
}

export function meta() {
  return [{ title: "Предоплата — Арт-Кыры" }];
}

export function HydrateFallback() {
  return <p>Загрузка…</p>;
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

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      width="14"
      height="14"
    >
      <path d="M5 12.5 10 17l9-9" />
    </svg>
  );
}

function CardIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      width="20"
      height="20"
    >
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <path d="M7 15h4" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
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
      width="14"
      height="14"
    >
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 1 1 8 0v3" />
    </svg>
  );
}

/* ---------- Countdown ---------- */

function useCountdown(deadline: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return useMemo(() => {
    if (!deadline) return null;
    const ms = new Date(deadline).getTime() - now;
    if (ms <= 0) return { mm: "00", ss: "00", expired: true };
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return {
      mm: String(m).padStart(2, "0"),
      ss: String(s).padStart(2, "0"),
      expired: false,
    };
  }, [deadline, now]);
}

/* ---------- Page ---------- */

export function PaymentPage() {
  const { reservation } = useLoaderData() as { reservation: Reservation };
  const user = useAuthStore((s) => s.user);
  const revalidator = useRevalidator();

  useEffect(() => {
    document.title = "Оплата — Арт-Кыры";
  }, []);

  useEffect(() => {
    if (reservation.status !== "pending_payment") return;
    const t = setInterval(() => revalidator.revalidate(), 5000);
    return () => clearInterval(t);
  }, [reservation.status, revalidator]);

  const countdown = useCountdown(reservation.hold_expires_at);

  // For editable contact data — pre-fill from user
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [email] = useState(user?.email ?? "");
  const [agreed, setAgreed] = useState(false);

  const variant = statusVariant(reservation.status);
  const isPending = reservation.status === "pending_payment";
  const isConfirmed = reservation.status === "confirmed";

  if (isConfirmed) {
    return (
      <div className="inner-shell">
        <header className="page-header">
          <span className="eyebrow">01 / Минеральный · Подтверждение</span>
          <h1 className="display page-header__title">Бронь подтверждена</h1>
          <p className="muted" style={{ maxWidth: 640 }}>
            {formatDateLong(reservation.start_time)} в {formatTime(reservation.start_time)} ·{" "}
            Стол № {reservation.table_id}. Предоплата {reservation.deposit_amount} ₽ учтена. Ждём вас
            в Арт-Кыры.
          </p>
          <div style={{ display: "flex", gap: 16 }}>
            <Link to="/profile" className="btn-cta">
              <span>В личный кабинет</span>
              <ArrowUpRight className="btn-cta__icon" />
            </Link>
          </div>
        </header>
      </div>
    );
  }

  if (!isPending) {
    return (
      <div className="inner-shell">
        <header className="page-header">
          <span className="eyebrow">Бронь #{reservation.id}</span>
          <h1 className="display page-header__title">
            {statusLabel(reservation.status)}
          </h1>
          <p className="muted" style={{ maxWidth: 640 }}>
            {formatDateTime(reservation.start_time)} · Стол № {reservation.table_id}
          </p>
        </header>
        <Link to="/profile" className="btn-cta" style={{ alignSelf: "flex-start" }}>
          <span>В личный кабинет</span>
          <ArrowUpRight className="btn-cta__icon" />
        </Link>
      </div>
    );
  }

  const total = reservation.deposit_amount;

  return (
    <div className="inner-shell">
      <header className="page-header">
        <span className="eyebrow">01 / Минеральный · Ваш визит</span>
        <h1 className="display page-header__title">Один шаг до встречи</h1>
        <p className="muted" style={{ maxWidth: 640 }}>
          Внесите обязательную предоплату, чтобы подтвердить выбранный столик.
        </p>
        <div className="steps" aria-label="Этапы бронирования">
          <div className="step">
            <span className="step__dot step__dot--active"><CheckIcon /></span>
            <span className="step__label step__label--active">Выбор столика</span>
          </div>
          <div className="step">
            <span className="step__dot step__dot--active">2</span>
            <span className="step__label step__label--active">Предоплата</span>
          </div>
          <div className="step">
            <span className="step__dot">3</span>
            <span className="step__label">Подтверждение</span>
          </div>
        </div>
      </header>

      <div className="countdown-banner" role="status">
        <div className="countdown-banner__timer">
          <span className="countdown-banner__timer-label">До конца удержания</span>
          <span className="countdown-banner__timer-value">
            {countdown
              ? countdown.expired
                ? "00:00"
                : `${countdown.mm}:${countdown.ss}`
              : "15:00"}
          </span>
        </div>
        <div className="countdown-banner__copy">
          <span className="countdown-banner__title">Стол удерживается 15 минут</span>
          <span className="countdown-banner__desc">
            Успешная оплата подтверждает бронь. Неоплата за 15 минут отменяет её, и стол снова
            становится доступным.
          </span>
        </div>
      </div>

      <div className="payment-grid">
        {/* LEFT: Contact + payment method */}
        <div className="payment-form">
          <div className="payment-stack">
            {/* Контактные данные */}
            <section className="panel">
              <div className="panel__head">
                <h2 className="panel__title">Контактные данные</h2>
                <span className="panel__hint">Личные данные</span>
              </div>
              <p className="panel__hint" style={{ marginTop: -8 }}>
                На эти контакты отправим подтверждение брони и информацию об оплате.
              </p>

              <div className="form-row">
                <label className="form-row__label" htmlFor="pay-name">Имя и фамилия</label>
                <input
                  id="pay-name"
                  className="form-row__input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Анна Соколова"
                />
              </div>

              <div className="form-row form-row--split">
                <div className="form-row">
                  <label className="form-row__label" htmlFor="pay-phone">Телефон</label>
                  <input
                    id="pay-phone"
                    className="form-row__input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+7 (___) ___-__-__"
                  />
                </div>
                <div className="form-row">
                  <label className="form-row__label" htmlFor="pay-email">Электронная почта</label>
                  <input
                    id="pay-email"
                    className="form-row__input"
                    type="email"
                    value={email}
                    readOnly
                  />
                </div>
              </div>
            </section>

            {/* Способ оплаты */}
            <section className="panel">
              <h2 className="panel__title">Способ оплаты</h2>

              <div className="payment-method">
                <span className="payment-method__icon">
                  <CardIcon />
                </span>
                <div className="payment-method__body">
                  <span className="payment-method__title">Банковская карта</span>
                  <span className="payment-method__desc">
                    Visa · Mastercard · МИР · СБП. Перенаправим на защищённую страницу оплаты.
                  </span>
                </div>
                <span className="payment-method__check">
                  <CheckIcon />
                </span>
              </div>

              <div className="secure-row">
                <span className="secure-row__pill">
                  <LockIcon /> PCI DSS
                </span>
                <span className="secure-row__pill">3-D Secure</span>
                <span className="secure-row__pill">Возврат до визита</span>
              </div>

              <hr className="divider-h" />

              <label className="consent">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                />
                <span>
                  Подтверждаю условия бронирования и предоплаты. Знаю, что предоплата
                  учитывается в счёте за визит и не является полной стоимостью заказа.
                </span>
              </label>

              <Form method="post">
                <button
                  type="submit"
                  className="payment-cta"
                  disabled={!agreed}
                >
                  <span>Оплатить {total.toLocaleString("ru-RU")} ₽</span>
                  <ArrowUpRight />
                </button>
              </Form>

              <p className="payment-hint">
                После успешной оплаты бронь получит статус «Подтверждено». Stub-режим имитирует
                успешный платёж через /dev/payment/{reservation.id}/confirm.
              </p>
            </section>
          </div>
        </div>

        {/* RIGHT: Summary card */}
        <aside className="payment-summary" aria-label="Итог бронирования">
          <div className="payment-summary__photo">
            <img src="/assets/table-payment.png" alt="Столик в зале Арт-Кыры" />
          </div>

          <div className="payment-summary__body">
            <header className="payment-summary__head">
              <h2 className="payment-summary__name">Столик № {reservation.table_id}</h2>
              <span className={`status-pill status-pill--${variant}`}>
                <span className="status-pill__dot" />
                {statusLabel(reservation.status)}
              </span>
              <span className="payment-summary__meta">
                У панорамного окна. Тихая зона основного зала, мягкие кресла.
              </span>
            </header>

            <dl className="payment-summary__params">
              <div className="payment-summary__param">
                <dt>Дата</dt>
                <dd><b>{formatDateLong(reservation.start_time)}</b></dd>
              </div>
              <div className="payment-summary__param">
                <dt>Время</dt>
                <dd><b>{formatTime(reservation.start_time)}</b></dd>
              </div>
              <div className="payment-summary__param">
                <dt>Стол</dt>
                <dd><b>№ {reservation.table_id}</b></dd>
              </div>
              <div className="payment-summary__param">
                <dt>Гости</dt>
                <dd><b>{reservation.guests_count}</b></dd>
              </div>
            </dl>

            <hr className="divider-h" />

            <div className="payment-summary__deposit-row">
              <span>Предоплата</span>
              <b>1 500 ₽ × {reservation.guests_count}</b>
            </div>

            <div className="payment-summary__total">
              <span className="payment-summary__total-label">К оплате</span>
              <span className="payment-summary__total-amount">
                {total.toLocaleString("ru-RU")} ₽
              </span>
            </div>

            <p className="payment-summary__footnote">
              Предоплата учитывается в счёте за визит. Это не полный счёт за ресторанный заказ:
              оставшуюся сумму вы оплатите в ресторане.
            </p>

            <hr className="divider-h" />

            <Link to="/reserve" className="payment-summary__back">
              ← Вернуться к выбору столика
            </Link>
          </div>
        </aside>
      </div>

      <p className="payment-summary__footnote-outer">
        Если время удержания истечёт, неоплаченная бронь отменится автоматически. Вы сможете
        выбрать свободный стол заново.
      </p>

      <div className="help-strip">
        <span className="help-strip__desc">
          Нужна помощь с бронированием или оплатой?
        </span>
        <a href="tel:+74950000000" className="help-strip__cta">
          +7 (495) 000-00-00 · Связаться с рестораном ↗
        </a>
      </div>
    </div>
  );
}