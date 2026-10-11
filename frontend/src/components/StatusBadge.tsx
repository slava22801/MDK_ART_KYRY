import type { ReservationStatus } from "@/lib/types";

const labels: Record<ReservationStatus, { text: string; tone: string }> = {
  pending_payment: { text: "Ожидает оплаты", tone: "badge--warn" },
  confirmed: { text: "Подтверждено", tone: "badge--ok" },
  cancelled_timeout: { text: "Отменено (таймаут)", tone: "badge--mute" },
  cancelled_user: { text: "Отменено", tone: "badge--mute" },
  cancelled_admin: { text: "Отменено админом", tone: "badge--mute" },
  completed: { text: "Завершено", tone: "badge--ok" },
};

export function StatusBadge({ status }: { status: ReservationStatus }) {
  const cfg = labels[status];
  return <span className={`badge ${cfg.tone}`}>{cfg.text}</span>;
}