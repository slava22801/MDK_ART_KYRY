import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";

import { RootLayout } from "@/routes/root";
import { HomePage } from "@/routes/home";
import { MenuPage } from "@/routes/menu";
import { ContactsPage } from "@/routes/contacts";
import { ReservePage } from "@/routes/reserve";
import { LoginPage } from "@/routes/login";
import { RegisterPage } from "@/routes/register";
import { ProfilePage } from "@/routes/profile";
import { PaymentPage } from "@/routes/payment";

import { AdminLayout } from "@/routes/admin";
import { AdminIndex } from "@/routes/admin/index";
import { AdminTablesPage } from "@/routes/admin/tables";
import { AdminReservationsPage } from "@/routes/admin/reservations";
import { AdminMenuPage } from "@/routes/admin/menu";

import { RouteErrorBoundary } from "@/components/ErrorBoundary";

import "@/styles.css";

const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayout,
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, Component: HomePage },
      { path: "menu", Component: MenuPage },
      { path: "contacts", Component: ContactsPage },
      { path: "reserve", Component: ReservePage, errorElement: <RouteErrorBoundary /> },
      { path: "login", Component: LoginPage },
      { path: "register", Component: RegisterPage },
      { path: "profile", Component: ProfilePage, errorElement: <RouteErrorBoundary /> },
      { path: "payment/:id", Component: PaymentPage, errorElement: <RouteErrorBoundary /> },
    ],
  },
  {
    path: "/admin",
    Component: AdminLayout,
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, Component: AdminIndex },
      { path: "tables", Component: AdminTablesPage },
      { path: "reservations", Component: AdminReservationsPage },
      { path: "menu", Component: AdminMenuPage },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);