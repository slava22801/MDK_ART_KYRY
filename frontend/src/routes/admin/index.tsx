import { useEffect } from "react";
import { useLoaderData, useRevalidator } from "react-router";

import { api } from "@/lib/api";
import type { DashboardStats } from "@/lib/types";

export async function clientLoader() {
  const stats = await api.admin.stats();
  return { stats };
}

export function meta() {
  return [{ title: "Дашборд — Арт-Кыры" }];
}

export function HydrateFallback() {
  return <p>Загрузка…</p>;
}

function Card({ label, value, tone }: { label: string; value: string | number; tone?: "ok" | "warn" | "mute" }) {
  return (
    <div className={`stat-card${tone ? ` stat-card--${tone}` : ""}`}>
      <div className="stat-card__value">{value}</div>
      <div className="stat-card__label">{label}</div>
    </div>
  );
}

export function AdminIndex() {
  const { stats } = useLoaderData() as { stats: DashboardStats };
  const revalidator = useRevalidator();

  useEffect(() => {
    document.title = "Дашборд — Арт-Кыры";
  }, []);

  useEffect(() => {
    const t = setInterval(() => revalidator.revalidate(), 30_000);
    return () => clearInterval(t);
  }, [revalidator]);

  return (
    <section>
      <h1>Дашборд</h1>
      <p className="hint">Автообновление каждые 30 секунд</p>

      <h2>Сегодня</h2>
      <div className="stats-grid">
        <Card label="Подтверждено" value={stats.today.confirmed} tone="ok" />
        <Card label="Ожидают оплаты" value={stats.today.pending_payment} tone="warn" />
        <Card label="Отменено (таймаут)" value={stats.today.cancelled_timeout} tone="mute" />
      </div>

      <h2>Финансы</h2>
      <div className="stats-grid">
        <Card label="Выручка за неделю" value={`${stats.revenue_week.toLocaleString("ru-RU")} ₽`} />
        <Card label="Выручка всего" value={`${stats.revenue_total.toLocaleString("ru-RU")} ₽`} />
        <Card label="Предстоящие (7 дней)" value={stats.upcoming_7d} />
      </div>
    </section>
  );
}