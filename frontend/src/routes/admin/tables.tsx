import { useState } from "react";
import { useLoaderData, useRevalidator } from "react-router";

import { api } from "@/lib/api";
import type { Table } from "@/lib/types";

export async function clientLoader() {
  const tables = await api.admin.tables.listAll();
  return { tables };
}

export function meta() {
  return [{ title: "Столы — Админ" }];
}

export function HydrateFallback() {
  return <p>Загрузка…</p>;
}

export function AdminTablesPage() {
  const { tables } = useLoaderData() as { tables: Table[] };
  const revalidator = useRevalidator();

  const [editing, setEditing] = useState<Table | null>(null);
  const [creating, setCreating] = useState(false);
  const [number, setNumber] = useState("");
  const [capacity, setCapacity] = useState(2);
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function startCreate() {
    setEditing(null);
    setCreating(true);
    setNumber("");
    setCapacity(2);
    setIsActive(true);
    setError(null);
  }

  function startEdit(t: Table) {
    setCreating(false);
    setEditing(t);
    setNumber(t.number);
    setCapacity(t.capacity);
    setIsActive(t.is_active);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (editing) {
        await api.admin.tables.update(editing.id, { number, capacity, is_active: isActive });
      } else {
        await api.admin.tables.create({ number, capacity, is_active: isActive });
      }
      setEditing(null);
      setCreating(false);
      revalidator.revalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ошибка");
    }
  }

  async function remove(t: Table) {
    if (!confirm(`Удалить стол №${t.number}?`)) return;
    try {
      await api.admin.tables.remove(t.id);
      revalidator.revalidate();
    } catch (err) {
      alert(err instanceof Error ? err.message : "ошибка удаления");
    }
  }

  const showForm = creating || editing !== null;

  return (
    <section>
      <header className="admin__header">
        <h1>Столы</h1>
        {!showForm && <button className="btn" onClick={startCreate}>+ Добавить</button>}
      </header>

      {showForm && (
        <form className="form card" onSubmit={submit}>
          <h3>{editing ? `Редактировать стол №${editing.number}` : "Новый стол"}</h3>
          <label>
            Номер
            <input value={number} onChange={(e) => setNumber(e.target.value)} required />
          </label>
          <label>
            Вместимость
            <input
              type="number"
              min={1}
              max={50}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              required
            />
          </label>
          <label className="form__checkbox">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Активен
          </label>
          {error && <p className="error">{error}</p>}
          <div className="form__actions">
            <button type="submit">Сохранить</button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => { setCreating(false); setEditing(null); }}
            >
              Отмена
            </button>
          </div>
        </form>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>№</th>
            <th>Вместимость</th>
            <th>Статус</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {tables.map((t) => (
            <tr key={t.id}>
              <td>{t.number}</td>
              <td>{t.capacity}</td>
              <td>
                <span className={`badge ${t.is_active ? "badge--ok" : "badge--mute"}`}>
                  {t.is_active ? "Активен" : "Отключён"}
                </span>
              </td>
              <td className="table__actions">
                <button className="btn btn--ghost" onClick={() => startEdit(t)}>Изменить</button>
                <button className="btn btn--danger" onClick={() => remove(t)}>Удалить</button>
              </td>
            </tr>
          ))}
          {tables.length === 0 && (
            <tr>
              <td colSpan={4} className="empty">Столов пока нет.</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}