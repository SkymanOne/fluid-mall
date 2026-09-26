import "./app.css";
import { Links, Meta, Outlet, Scripts } from "react-router";

export function links() {
  return [
    { rel: "preconnect", href: "https://fonts.googleapis.com" },
    { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" as const },
    {
      rel: "stylesheet",
      href: "https://fonts.googleapis.com/css2?family=Sofia+Sans:wght@400;600;700&family=Sofia+Sans+Condensed:wght@600;700&family=Sofia+Sans+Extra+Condensed:wght@800&display=swap",
    },
    { rel: "preload", as: "image", href: "/looks/tech.webp" },
  ];
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#F5F4F0" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}
