import { SupabaseProvider } from "@fluid-mall/app";
import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";

import type { Route } from "./+types/root";
import { supabase } from "./supabase";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function HydrateFallback() {
  return <p>Loading</p>;
}

export default function App() {
  return (
    <SupabaseProvider value={supabase}>
      <Outlet />
    </SupabaseProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  if (isRouteErrorResponse(error)) {
    return <h1>{error.status === 404 ? "Not found" : error.statusText || "Error"}</h1>;
  }
  return (
    <main>
      <h1>Error</h1>
      {import.meta.env.DEV && error instanceof Error && <pre>{error.stack}</pre>}
    </main>
  );
}
