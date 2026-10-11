import { useEffect } from "react";
import { Link, NavLink, Outlet, redirect, useLoaderData } from "react-router";

import { useAuthStore } from "@/store/auth";

export async function clientLoader() {
  const user = useAuthStore.getState().user;
  if (!user) throw redirect("/login");
  if (user.role !== "admin") throw redirect("/");
  return { user };
}

export function meta() {
  return [{ title: "Админ-панель — Арт-Кыры" }];
}

export function HydrateFallback() {
  return <p>Загрузка…</p>;
}

export function AdminLayout() {
  const data = useLoaderData() as { user?: { name: string | null; email: string } } | undefined;
  // Страховка на случай, если loader не отработал (например, при серверном рендере):
  // без неё деструктуризация undefined роняет весь админ-Shell в error boundary.
  const user = data?.user;

  useEffect(() => {
    document.title = "Админ-панель — Арт-Кыры";
  }, []);

  if (!user) {
    return (
      <div className="admin">
        <main className="admin__main">
          <p className="muted">Загрузка…</p>
        </main>
      </div>
    );
  }

  return (
    <div className="admin">
      <aside className="admin__sidebar">
        <Link to="/" className="brand">Арт-Кыры</Link>
        <p className="admin__user">{user.name ?? user.email}</p>
        <nav className="admin__nav">
          <NavLink to="/admin" end>📊 Дашборд</NavLink>
          <NavLink to="/admin/tables">🪑 Столы</NavLink>
          <NavLink to="/admin/reservations">📅 Бронирования</NavLink>
          <NavLink to="/admin/menu">🍽 Меню</NavLink>
        </nav>
      </aside>
      <main className="admin__main">
        <Outlet />
      </main>
    </div>
  );
}