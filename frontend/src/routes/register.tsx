import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { useAuthStore } from "@/store/auth";

export function RegisterPage() {
  const register = useAuthStore((s) => s.register);
  const error = useAuthStore((s) => s.error);
  const loading = useAuthStore((s) => s.loading);
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    document.title = "Регистрация — Арт-Кыры";
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await register({ email, password, name: name || undefined, phone: phone || undefined });
      navigate("/profile");
    } catch {
      /* error в store */
    }
  }

  return (
    <section className="form-page">
      <h1>Регистрация</h1>
      <form onSubmit={onSubmit} className="form">
        <label>
          Email *
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Пароль * (мин. 6 символов)
          <input
            type="password"
            value={password}
            minLength={6}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <label>
          Имя
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Телефон
          <input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? "Создаём…" : "Зарегистрироваться"}
        </button>
      </form>
    </section>
  );
}