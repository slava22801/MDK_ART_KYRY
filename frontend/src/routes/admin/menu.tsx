import { useState } from "react";
import { useLoaderData, useRevalidator } from "react-router";

import { api } from "@/lib/api";
import type { MenuCategory, MenuItem } from "@/lib/types";

export async function clientLoader() {
  const categories = await api.menu.list();
  return { categories };
}

export function meta() {
  return [{ title: "Меню — Админ" }];
}

export function HydrateFallback() {
  return <p>Загрузка…</p>;
}

type ItemDraft = {
  category_id: number;
  name: string;
  description: string;
  price: number;
  is_active: boolean;
};

type CategoryDraft = {
  name: string;
  description: string;
  sort_order: number;
};

export function AdminMenuPage() {
  const { categories } = useLoaderData() as { categories: MenuCategory[] };
  const revalidator = useRevalidator();

  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft>({
    name: "",
    description: "",
    sort_order: 0,
  });

  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [creatingItem, setCreatingItem] = useState<number | null>(null);
  const [itemDraft, setItemDraft] = useState<ItemDraft>({
    category_id: 0,
    name: "",
    description: "",
    price: 0,
    is_active: true,
  });
  const [uploading, setUploading] = useState<number | null>(null);

  const [error, setError] = useState<string | null>(null);

  function startCreateCategory() {
    setEditingCategory(null);
    setCreatingCategory(true);
    setCategoryDraft({ name: "", description: "", sort_order: (categories.length + 1) * 10 });
    setError(null);
  }

  function startEditCategory(c: MenuCategory) {
    setCreatingCategory(false);
    setEditingCategory(c);
    setCategoryDraft({
      name: c.name,
      description: c.description ?? "",
      sort_order: c.sort_order,
    });
    setError(null);
  }

  async function submitCategory(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (editingCategory) {
        await api.admin.menu.updateCategory(editingCategory.id, categoryDraft);
      } else {
        await api.admin.menu.createCategory(categoryDraft);
      }
      setEditingCategory(null);
      setCreatingCategory(false);
      revalidator.revalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ошибка");
    }
  }

  async function removeCategory(c: MenuCategory) {
    if (!confirm(`Удалить категорию «${c.name}»? Сначала удалите все блюда.`)) return;
    try {
      await api.admin.menu.removeCategory(c.id);
      revalidator.revalidate();
    } catch (err) {
      alert(err instanceof Error ? err.message : "ошибка удаления");
    }
  }

  function startCreateItem(categoryId: number) {
    setEditingItem(null);
    setCreatingItem(categoryId);
    setItemDraft({
      category_id: categoryId,
      name: "",
      description: "",
      price: 0,
      is_active: true,
    });
    setError(null);
  }

  function startEditItem(item: MenuItem) {
    setCreatingItem(null);
    setEditingItem(item);
    setItemDraft({
      category_id: item.category_id,
      name: item.name,
      description: item.description ?? "",
      price: item.price,
      is_active: item.is_active,
    });
    setError(null);
  }

  async function submitItem(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (editingItem) {
        await api.admin.menu.updateItem(editingItem.id, itemDraft);
      } else if (creatingItem) {
        await api.admin.menu.createItem(itemDraft);
      }
      setEditingItem(null);
      setCreatingItem(null);
      revalidator.revalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ошибка");
    }
  }

  async function removeItem(item: MenuItem) {
    if (!confirm(`Удалить «${item.name}»?`)) return;
    try {
      await api.admin.menu.removeItem(item.id);
      revalidator.revalidate();
    } catch (err) {
      alert(err instanceof Error ? err.message : "ошибка удаления");
    }
  }

  async function uploadImage(itemId: number, file: File) {
    setUploading(itemId);
    try {
      const res = await api.admin.menu.uploadImage(file);
      await api.admin.menu.updateItem(itemId, { image_key: res.image_key });
      revalidator.revalidate();
    } catch (err) {
      alert(err instanceof Error ? err.message : "ошибка загрузки");
    } finally {
      setUploading(null);
    }
  }

  const showCategoryForm = creatingCategory || editingCategory !== null;
  const showItemForm = creatingItem !== null || editingItem !== null;

  return (
    <section>
      <header className="admin__header">
        <h1>Меню</h1>
        {!showCategoryForm && (
          <button className="btn" onClick={startCreateCategory}>+ Категория</button>
        )}
      </header>

      {showCategoryForm && (
        <form className="form card" onSubmit={submitCategory}>
          <h3>{editingCategory ? `Категория: ${editingCategory.name}` : "Новая категория"}</h3>
          <label>
            Название
            <input
              value={categoryDraft.name}
              onChange={(e) => setCategoryDraft({ ...categoryDraft, name: e.target.value })}
              required
            />
          </label>
          <label>
            Описание
            <input
              value={categoryDraft.description}
              onChange={(e) => setCategoryDraft({ ...categoryDraft, description: e.target.value })}
            />
          </label>
          <label>
            Порядок сортировки
            <input
              type="number"
              value={categoryDraft.sort_order}
              onChange={(e) =>
                setCategoryDraft({ ...categoryDraft, sort_order: Number(e.target.value) })
              }
            />
          </label>
          {error && <p className="error">{error}</p>}
          <div className="form__actions">
            <button type="submit">Сохранить</button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => { setCreatingCategory(false); setEditingCategory(null); }}
            >
              Отмена
            </button>
          </div>
        </form>
      )}

      {showItemForm && (
        <form className="form card" onSubmit={submitItem}>
          <h3>{editingItem ? `Блюдо: ${editingItem.name}` : "Новое блюдо"}</h3>
          <label>
            Категория
            <select
              value={itemDraft.category_id}
              onChange={(e) => setItemDraft({ ...itemDraft, category_id: Number(e.target.value) })}
              required
            >
              <option value={0} disabled>Выберите…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label>
            Название
            <input
              value={itemDraft.name}
              onChange={(e) => setItemDraft({ ...itemDraft, name: e.target.value })}
              required
            />
          </label>
          <label>
            Описание
            <input
              value={itemDraft.description}
              onChange={(e) => setItemDraft({ ...itemDraft, description: e.target.value })}
            />
          </label>
          <label>
            Цена, ₽
            <input
              type="number"
              min={0}
              value={itemDraft.price}
              onChange={(e) => setItemDraft({ ...itemDraft, price: Number(e.target.value) })}
              required
            />
          </label>
          <label className="form__checkbox">
            <input
              type="checkbox"
              checked={itemDraft.is_active}
              onChange={(e) => setItemDraft({ ...itemDraft, is_active: e.target.checked })}
            />
            Активно
          </label>
          {error && <p className="error">{error}</p>}
          <div className="form__actions">
            <button type="submit">Сохранить</button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => { setCreatingItem(null); setEditingItem(null); }}
            >
              Отмена
            </button>
          </div>
        </form>
      )}

      {categories.map((cat) => (
        <article key={cat.id} className="card">
          <header className="admin__header">
            <div>
              <h3>{cat.name}</h3>
              {cat.description && <p className="hint">{cat.description}</p>}
            </div>
            <div className="table__actions">
              <button className="btn btn--ghost" onClick={() => startEditCategory(cat)}>Изменить</button>
              <button className="btn btn--danger" onClick={() => removeCategory(cat)}>Удалить</button>
              <button className="btn" onClick={() => startCreateItem(cat.id)}>+ Блюдо</button>
            </div>
          </header>
          <table className="table">
            <thead>
              <tr>
                <th>Фото</th>
                <th>Название</th>
                <th>Цена</th>
                <th>Статус</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(cat.items ?? []).map((it) => (
                <tr key={it.id}>
                  <td>
                    {it.image_url ? (
                      <img src={it.image_url} alt={it.name} className="thumb" />
                    ) : (
                      <label className="btn btn--ghost thumb-upload">
                        {uploading === it.id ? "…" : "Загрузить"}
                        <input
                          type="file"
                          accept="image/*"
                          hidden
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) uploadImage(it.id, f);
                          }}
                        />
                      </label>
                    )}
                  </td>
                  <td>
                    <strong>{it.name}</strong>
                    {it.description && <div className="hint">{it.description}</div>}
                  </td>
                  <td>{it.price} ₽</td>
                  <td>
                    <span className={`badge ${it.is_active ? "badge--ok" : "badge--mute"}`}>
                      {it.is_active ? "Активно" : "Скрыто"}
                    </span>
                  </td>
                  <td className="table__actions">
                    <button className="btn btn--ghost" onClick={() => startEditItem(it)}>Изменить</button>
                    <button className="btn btn--danger" onClick={() => removeItem(it)}>Удалить</button>
                  </td>
                </tr>
              ))}
              {(cat.items ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="empty">Блюд пока нет.</td>
                </tr>
              )}
            </tbody>
          </table>
        </article>
      ))}

      {categories.length === 0 && (
        <p className="empty">Категорий пока нет — создайте первую.</p>
      )}
    </section>
  );
}