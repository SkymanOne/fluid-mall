import "./app.css";
import { useEffect } from "react";
import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";

import type { Route } from "./+types/root";
import { SupabaseProvider } from "./lib/supabase";
import { supabase } from "./supabase";

export const links: Route.LinksFunction = () => [
  { rel: "manifest", href: "/manifest.webmanifest" },
  { rel: "icon", href: "/icon-192.png", type: "image/png" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Sofia+Sans:wght@400;600;700&family=Sofia+Sans+Condensed:wght@600;700&family=Sofia+Sans+Extra+Condensed:wght@800&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#F5F4F0" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Fluid" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
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
  return null;
}

export default function App() {
  useEffect(() => {
    if (import.meta.env.PROD && "serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");
  }, []);
  return (
    <SupabaseProvider value={supabase}>
      <Outlet />
    </SupabaseProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="flex max-w-md flex-col gap-2">
        <h1 className="font-numeral text-6xl font-extrabold">{isRouteErrorResponse(error) && error.status === 404 ? "NOT FOUND" : "ERROR"}</h1>
        {import.meta.env.DEV && error instanceof Error && <pre className="text-sm whitespace-pre-wrap">{error.stack}</pre>}
      </div>
    </main>
  );
}
