import { useEffect } from "react";
import { useLoaderData } from "react-router";

import { api } from "@/lib/api";
import type { MenuCategory } from "@/lib/types";

/* ---------- Loader ---------- */

export async function clientLoader() {
  try {
    const categories = await api.menu.list();
    return { categories, error: null as string | null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Не удалось загрузить меню";
    return { categories: [] as MenuCategory[], error: message };
  }
}

export function meta() {
  return [{ title: "Меню — Арт-Кыры" }];
}

export function HydrateFallback() {
  return <p>Загрузка меню…</p>;
}

/* ---------- Helpers ---------- */

function formatPrice(value: number): string {
  return `${value.toLocaleString("ru-RU")} ₽`;
}

/* ---------- Page ---------- */

export function MenuPage() {
  const data = (useLoaderData() as
    | { categories: MenuCategory[]; error: string | null }
    | undefined) ?? { categories: [], error: null };
  const { categories, error } = data;

  useEffect(() => {
    document.title = "Меню — Арт-Кыры";
  }, []);

  return (
    <div className="inner-shell menu-page">
      <header className="page-header">
        <span className="eyebrow">01 / Минеральный · Меню Арт-Кыры</span>
        <h1 className="display page-header__title">Сезонное меню</h1>
        <p className="muted" style={{ maxWidth: 640 }}>
          Сезонные блюда, напитки и десерты — всё, что готовим сейчас. Меню обновляется
          вместе с поставками от локальных ферм.
        </p>
      </header>

      {error && (
        <div className="panel" role="alert">
          <span className="status-pill status-pill--warn">
            <span className="status-pill__dot" />
            Не удалось загрузить меню
          </span>
          <p className="panel__hint">
            Проверьте подключение к серверу и попробуйте обновить страницу. <br />
            <span className="muted">{error}</span>
          </p>
        </div>
      )}

      {!error && categories.length === 0 && (
        <p className="empty">Меню скоро появится.</p>
      )}

      {categories.map((cat) => {
        const items = cat.items ?? [];
        return (
          <section key={cat.id} className="menu-section-block">
            <header className="menu-section-block__head">
              <h2 className="menu-section-block__title">{cat.name}</h2>
              {cat.description && (
                <p className="menu-section-block__desc">{cat.description}</p>
              )}
            </header>

            {items.length === 0 ? (
              <p className="empty">Нет блюд в этой категории.</p>
            ) : (
              <ul className="menu-grid">
                {items.map((it) => (
                  <li key={it.id} className="menu-card">
                    {it.image_url ? (
                      <div className="menu-card__photo">
                        <img src={it.image_url} alt={it.name} loading="lazy" />
                      </div>
                    ) : (
                      <div className="menu-card__photo menu-card__photo--empty" />
                    )}
                    <div className="menu-card__body">
                      <div className="menu-card__head">
                        <h3 className="menu-card__name">{it.name}</h3>
                        <span className="menu-card__price">{formatPrice(it.price)}</span>
                      </div>
                      {it.description && (
                        <p className="menu-card__desc">{it.description}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <div className="help-strip">
        <div className="help-strip__copy">
          <span className="help-strip__title">Не нашли любимое блюдо?</span>
          <span className="help-strip__desc">
            Расскажите о предпочтениях — подберём вино, учтём аллергии и поможем с выбором.
          </span>
        </div>
        <a href="tel:+74950000000" className="help-strip__cta">
          Связаться с рестораном ↗
        </a>
      </div>
    </div>
  );
}