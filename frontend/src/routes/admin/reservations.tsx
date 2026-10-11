import { useState } from "react";
import { useLoaderData, useRevalidator } from "react-router";

import { StatusBadge } from "@/components/StatusBadge";
import { api } from "@/lib/api";
import type { Reservation, ReservationStatus } from "@/lib/types";

const STATUSES: (ReservationStatus | "all")[] = [
  "all",
  "pending_payment",
  "confirmed",
  "cancelled_timeout",
  "cancelled_user",
  "cancelled_admin",
  "completed",
];

const STATUS_LABELS: Record<ReservationStatus | "all", string> = {
  all: "Все",
  pending_payment: "Ожидают оплаты",
  confirmed: "Подтверждённые",
  cancelled_timeout: "Таймаут",
  cancelled_user: "Отменены клиентом",
  cancelled_admin: "Отменены админом",
  completed: "Завершены",
};

export async function clientLoader() {
  const reservations = await api.admin.reservations.listAll();
  return { reservations };
}

export function meta() {
  return [{ title: "Бронирования — Админ" }];
}

export function HydrateFallback() {
  return <p>Загрузка…</p>;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminReservationsPage() {
  const { reservations } = useLoaderData() as { reservations: Reservation[] };
  const revalidator = useRevalidator();
  const [filter, setFilter] = useState<ReservationStatus | "all">("all");
  const [error, setError] = useState<string | null>(null);

  const filtered = filter === "all"
    ? reservations
    : reservations.filter((r) => r.status === filter);

  async function changeStatus(id: number, newStatus: ReservationStatus) {
    setError(null);
    try {
      await api.admin.reservations.updateStatus(id, newStatus);
      revalidator.revalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ошибка");
    }
  }

  return (
    <section>
      <h1>Бронирования</h1>

      <div className="filters">
        {STATUSES.map((s) => (
          <button
            key={s}
            className={`btn btn--ghost filter-btn${filter === s ? " filter-btn--active" : ""}`}
            onClick={() => setFilter(s)}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {error && <p className="error">{error}</p>}

      <table className="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Стол</th>
            <th>Начало</th>
            <th>Гостей</th>
            <th>Депозит</th>
            <th>Статус</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td>№{r.table_id}</td>
              <td>{formatDateTime(r.start_time)}</td>
              <td>{r.guests_count}</td>
              <td>{r.deposit_amount} ₽</td>
              <td><StatusBadge status={r.status} /></td>
              <td className="table__actions">
                {r.status === "pending_payment" && (
                  <button
                    className="btn btn--ghost"
                    onClick={() => changeStatus(r.id, "confirmed")}
                  >
                    Подтвердить
                  </button>
                )}
                {(r.status === "confirmed" || r.status === "pending_payment") && (
                  <button
                    className="btn btn--danger"
                    onClick={() => changeStatus(r.id, "cancelled_admin")}
                  >
                    Отменить
                  </button>
                )}
                {r.status === "confirmed" && (
                  <button
                    className="btn btn--ghost"
                    onClick={() => changeStatus(r.id, "completed")}
                  >
                    Завершить
                  </button>
                )}
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={7} className="empty">Нет бронирований с этим статусом.</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}