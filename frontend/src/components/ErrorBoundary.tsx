import { Link, isRouteErrorResponse, useRouteError } from "react-router";

export function RouteErrorBoundary() {
  const error = useRouteError();

  let title = "Что-то пошло не так";
  let message = "Произошла непредвиденная ошибка. Попробуйте обновить страницу.";
  let status: number | undefined;

  if (isRouteErrorResponse(error)) {
    status = error.status;
    title = `${error.status} ${error.statusText}`;
    if (typeof error.data === "string") {
      message = error.data;
    } else if (error.data && typeof error.data === "object" && "detail" in error.data) {
      const detail = (error.data as { detail: unknown }).detail;
      if (typeof detail === "string") message = detail;
    }
  } else if (error instanceof Error) {
    message = error.message;
  }

  return (
    <section className="error-page">
      <h1>{title}</h1>
      <p>{message}</p>
      {status === 404 ? (
        <Link to="/" className="btn">На главную</Link>
      ) : (
        <button onClick={() => window.location.reload()} className="btn">
          Обновить страницу
        </button>
      )}
    </section>
  );
}