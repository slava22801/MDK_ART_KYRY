import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";

import { RootLayout } from "@/routes/root";
import { HomePage } from "@/routes/home";
import { MenuPage, clientLoader as menuLoader } from "@/routes/menu";
import { ContactsPage } from "@/routes/contacts";
import { ReservePage, clientLoader as reserveLoader, clientAction as reserveAction } from "@/routes/reserve";
import { LoginPage } from "@/routes/login";
import { RegisterPage } from "@/routes/register";
import { ProfilePage, clientLoader as profileLoader } from "@/routes/profile";
import { PaymentPage, clientLoader as paymentLoader, clientAction as paymentAction } from "@/routes/payment";

import { AdminLayout, clientLoader as adminLoader } from "@/routes/admin";
import { AdminIndex, clientLoader as adminIndexLoader } from "@/routes/admin/index";
import { AdminTablesPage, clientLoader as adminTablesLoader } from "@/routes/admin/tables";
import {
  AdminReservationsPage,
  clientLoader as adminReservationsLoader,
} from "@/routes/admin/reservations";
import { AdminMenuPage, clientLoader as adminMenuLoader } from "@/routes/admin/menu";

import { RouteErrorBoundary } from "@/components/ErrorBoundary";

import "@/styles.css";

const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayout,
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, Component: HomePage },
      { path: "menu", Component: MenuPage, loader: menuLoader },
      { path: "contacts", Component: ContactsPage },
      {
        path: "reserve",
        Component: ReservePage,
        loader: reserveLoader,
        action: reserveAction,
        errorElement: <RouteErrorBoundary />,
      },
      { path: "login", Component: LoginPage },
      { path: "register", Component: RegisterPage },
      {
        path: "profile",
        Component: ProfilePage,
        loader: profileLoader,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: "payment/:id",
        Component: PaymentPage,
        loader: paymentLoader,
        action: paymentAction,
        errorElement: <RouteErrorBoundary />,
      },
    ],
  },
  {
    path: "/admin",
    Component: AdminLayout,
    loader: adminLoader,
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, Component: AdminIndex, loader: adminIndexLoader },
      { path: "tables", Component: AdminTablesPage, loader: adminTablesLoader },
      { path: "reservations", Component: AdminReservationsPage, loader: adminReservationsLoader },
      { path: "menu", Component: AdminMenuPage, loader: adminMenuLoader },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);