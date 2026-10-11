import type {
  AvailabilityQuery,
  CreateReservationInput,
  DashboardStats,
  MenuCategory,
  MenuImageUpload,
  MenuItem,
  Reservation,
  ReservationStatus,
  ReservationWithPayment,
  Table,
  Token,
} from "@/lib/types";
import { ApiError } from "@/lib/http";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

function authHeader(): HeadersInit {
  const token = localStorage.getItem("access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Превращает JSON-ответ FastAPI с `{"detail": "..."}` в человекочитаемое сообщение. */
function extractErrorMessage(parsed: unknown, fallback: string): string {
  if (!parsed) return fallback;
  if (typeof parsed === "string") return parsed;
  if (typeof parsed === "object" && parsed !== null && "detail" in parsed) {
    const detail = (parsed as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      const first = detail[0];
      if (first && typeof first === "object" && "msg" in first) {
        const msg = (first as { msg: unknown }).msg;
        if (typeof msg === "string") return msg;
      }
    }
  }
  return fallback;
}

async function jsonRequest<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = { ...(authHeader() as Record<string, string>) };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let parsed: unknown;
    try {
      parsed = await res.json();
    } catch {
      parsed = await res.text();
    }
    const message = extractErrorMessage(parsed, `API ${res.status}`);
    throw new ApiError(res.status, message, parsed);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function multipartRequest<T>(
  method: string,
  path: string,
  formData: FormData,
): Promise<T> {
  const headers: Record<string, string> = { ...(authHeader() as Record<string, string>) };
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: formData,
  });
  if (!res.ok) {
    let parsed: unknown;
    try {
      parsed = await res.json();
    } catch {
      parsed = await res.text();
    }
    const message = extractErrorMessage(parsed, `API ${res.status}`);
    throw new ApiError(res.status, message, parsed);
  }
  return (await res.json()) as T;
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      jsonRequest<Token>("POST", "/auth/login", { email, password }),
    register: (data: {
      email: string;
      password: string;
      name?: string;
      phone?: string;
    }) => jsonRequest<Token>("POST", "/auth/register", data),
    me: () => jsonRequest<Token["user"]>("GET", "/auth/me"),
  },
  tables: {
    list: () => jsonRequest<Table[]>("GET", "/tables"),
    availability: (q: AvailabilityQuery) => {
      const params = new URLSearchParams({
        start_time: q.start_time,
        guests_count: String(q.guests_count),
      });
      return jsonRequest<Table[]>("GET", `/tables/availability?${params}`);
    },
  },
  reservations: {
    create: (input: CreateReservationInput) =>
      jsonRequest<ReservationWithPayment>("POST", "/reservations", input),
    my: () => jsonRequest<Reservation[]>("GET", "/reservations/me"),
    get: (id: number) => jsonRequest<Reservation>("GET", `/reservations/${id}`),
    cancel: (id: number) =>
      jsonRequest<Reservation>("POST", `/reservations/${id}/cancel`),
    devConfirmPayment: (id: number) =>
      jsonRequest<{ status: string }>("POST", `/dev/payment/${id}/confirm`),
  },
  menu: {
    list: () => jsonRequest<MenuCategory[]>("GET", "/menu"),
  },
  admin: {
    stats: () => jsonRequest<DashboardStats>("GET", "/admin/stats"),
    tables: {
      listAll: () => jsonRequest<Table[]>("GET", "/admin/tables/all"),
      create: (data: { number: string; capacity: number; is_active: boolean }) =>
        jsonRequest<Table>("POST", "/admin/tables", data),
      update: (id: number, data: Partial<{ number: string; capacity: number; is_active: boolean }>) =>
        jsonRequest<Table>("PATCH", `/admin/tables/${id}`, data),
      remove: (id: number) =>
        jsonRequest<void>("DELETE", `/admin/tables/${id}`),
    },
    reservations: {
      listAll: () => jsonRequest<Reservation[]>("GET", "/reservations/admin/reservations"),
      updateStatus: (id: number, status: ReservationStatus) =>
        jsonRequest<Reservation>("PATCH", `/reservations/admin/reservations/${id}`, { status }),
    },
    menu: {
      createCategory: (data: { name: string; description?: string; sort_order: number }) =>
        jsonRequest<MenuCategory>("POST", "/menu/admin/menu/categories", data),
      updateCategory: (id: number, data: Partial<{ name: string; description: string; sort_order: number }>) =>
        jsonRequest<MenuCategory>("PATCH", `/menu/admin/menu/categories/${id}`, data),
      removeCategory: (id: number) =>
        jsonRequest<void>("DELETE", `/menu/admin/menu/categories/${id}`),
      createItem: (data: {
        category_id: number;
        name: string;
        description?: string;
        price: number;
        is_active: boolean;
      }) => jsonRequest<MenuItem>("POST", "/menu/admin/menu/items", data),
      updateItem: (
        id: number,
        data: Partial<{ name: string; description: string; price: number; image_key: string; is_active: boolean; category_id: number }>,
      ) => jsonRequest<MenuItem>("PATCH", `/menu/admin/menu/items/${id}`, data),
      removeItem: (id: number) =>
        jsonRequest<void>("DELETE", `/menu/admin/menu/items/${id}`),
      uploadImage: (file: File) => {
        const fd = new FormData();
        fd.append("file", file);
        return multipartRequest<MenuImageUpload>("POST", "/menu/admin/menu/upload-image", fd);
      },
    },
  },
};