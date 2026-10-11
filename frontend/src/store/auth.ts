import { create } from "zustand";

import { api } from "@/lib/api";
import type { Token, User } from "@/lib/types";

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    name?: string;
    phone?: string;
  }) => Promise<void>;
  logout: () => void;
  hydrate: () => Promise<void>;
}

const TOKEN_KEY = "access_token";
const USER_KEY = "auth_user";

function persist(token: string, user: User) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearStorage() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  loading: false,
  error: null,

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const token: Token = await api.auth.login(email, password);
      persist(token.access_token, token.user);
      set({ user: token.user, token: token.access_token, loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : "login failed";
      set({ loading: false, error: message });
      throw err;
    }
  },

  register: async (data) => {
    set({ loading: true, error: null });
    try {
      const token: Token = await api.auth.register(data);
      persist(token.access_token, token.user);
      set({ user: token.user, token: token.access_token, loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : "registration failed";
      set({ loading: false, error: message });
      throw err;
    }
  },

  logout: () => {
    clearStorage();
    set({ user: null, token: null });
  },

  hydrate: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    const raw = localStorage.getItem(USER_KEY);
    if (!token || !raw) return;
    try {
      const user = JSON.parse(raw) as User;
      set({ token, user });
      api.auth.me().catch(() => {
        clearStorage();
        set({ user: null, token: null });
      });
    } catch {
      clearStorage();
    }
  },
}));