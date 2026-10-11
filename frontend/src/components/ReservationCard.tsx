import { useState } from "react";

import type { Reservation } from "@/lib/types";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";

interface Props {
  reservation: Reservation;
  cancellable?: boolean;
  onCancelled?: () => void;
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

export function ReservationCard({ reservation: r, cancellable, onCancelled }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setSubmitting(true);
    setError(null);
    try {
      await api.reservations.cancel(r.id);
      onCancelled?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ошибка отмены");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <article className="reservation-card">
      <header className="reservation-card__header">
        <h3>Бронь #{r.id} — столик №{r.table_id}</h3>
        <StatusBadge status={r.status} />
      </header>
      <dl className="reservation-card__meta">
        <div>
          <dt>Начало</dt>
          <dd>{formatDateTime(r.start_time)}</dd>
        </div>
        <div>
          <dt>Конец</dt>
          <dd>{formatDateTime(r.end_time)}</dd>
        </div>
        <div>
          <dt>Гостей</dt>
          <dd>{r.guests_count}</dd>
        </div>
        <div>
          <dt>Предоплата</dt>
          <dd>{r.deposit_amount} ₽</dd>
        </div>
      </dl>
      {cancellable && (
        <>
          <button
            type="button"
            disabled={submitting}
            className="btn btn--ghost"
            onClick={cancel}
          >
            {submitting ? "Отменяем…" : "Отменить"}
          </button>
          {error && <p className="error">{error}</p>}
        </>
      )}
    </article>
  );
}