import { useEffect } from "react";
import { Link, NavLink, Outlet } from "react-router";

import { useAuthStore } from "@/store/auth";

function UserRoundIcon() {
  return (
    <svg
      className="sign-in__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </svg>
  );
}

function ArrowUpRight() {
  return (
    <svg
      className="btn-cta__icon"
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

export function RootLayout() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <div className="app">
      <header className="header">
        <Link to="/" className="brand" aria-label="Арт-Кыры — на главную">
          <span className="brand__title">Арт-Кыры</span>
          <span className="brand__subtitle">РЕСТОРАН · МОСКВА</span>
        </Link>

        <nav className="nav" aria-label="Основная навигация">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `nav__link${isActive ? " nav__link--active" : ""}`
            }
          >
            Главная
          </NavLink>
          <NavLink
            to="/menu"
            className={({ isActive }) =>
              `nav__link${isActive ? " nav__link--active" : ""}`
            }
          >
            Меню
          </NavLink>
          <NavLink
            to="/contacts"
            className={({ isActive }) =>
              `nav__link${isActive ? " nav__link--active" : ""}`
            }
          >
            Контакты
          </NavLink>
        </nav>

        <div className="service-actions">
          {user ? (
            <>
              {user.role === "admin" && (
                <NavLink to="/admin" className="nav__link">
                  Админ
                </NavLink>
              )}
              <NavLink to="/profile" className="sign-in">
                {user.name ?? user.email}
              </NavLink>
              <button onClick={logout} className="sign-in" type="button">
                Выйти
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className="sign-in">
                <UserRoundIcon />
                <span>Войти</span>
              </NavLink>
            </>
          )}
          <Link to="/reserve" className="btn-cta">
            <span>Забронировать</span>
            <ArrowUpRight />
          </Link>
        </div>
      </header>

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}