export type Role = "client" | "admin";

export interface User {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  role: Role;
  created_at: string;
}

export interface Token {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Table {
  id: number;
  number: string;
  capacity: number;
  is_active: boolean;
}

export type ReservationStatus =
  | "pending_payment"
  | "confirmed"
  | "cancelled_timeout"
  | "cancelled_user"
  | "cancelled_admin"
  | "completed";

export interface Reservation {
  id: number;
  user_id: number;
  table_id: number;
  start_time: string;
  end_time: string;
  guests_count: number;
  status: ReservationStatus;
  deposit_amount: number;
  payment_id: string | null;
  payment_provider: string | null;
  hold_expires_at: string | null;
  created_at: string;
}

export interface ReservationWithPayment extends Reservation {
  payment_url: string | null;
}

export interface AvailabilityQuery {
  start_time: string;
  guests_count: number;
}

export interface CreateReservationInput {
  table_id: number;
  start_time: string;
  guests_count: number;
}

export interface MenuCategory {
  id: number;
  name: string;
  description: string | null;
  sort_order: number;
  items?: MenuItem[];
}

export interface MenuItem {
  id: number;
  category_id: number;
  name: string;
  description: string | null;
  price: number;
  image_key: string | null;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface MenuImageUpload {
  image_key: string;
  image_url: string;
}

export interface DashboardStats {
  today: {
    confirmed: number;
    pending_payment: number;
    cancelled_timeout: number;
  };
  revenue_week: number;
  revenue_total: number;
  upcoming_7d: number;
}