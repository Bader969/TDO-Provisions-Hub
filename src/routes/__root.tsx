import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth-context";
import { KerfaPrefsProvider } from "@/components/kerfa/KerfaKit";

import appCss from "../styles.css?url";
import kerfaCss from "../kerfa.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "TDO Provisions-Hub — Studio Desk" },
      {
        name: "description",
        content:
          "WhatsApp-Aufträge automatisch erfassen, sortieren, vergleichen und als 12-Blatt Abrechnung exportieren.",
      },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Urbanist:wght@400..700&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "stylesheet", href: kerfaCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: () => (
    <div className="signin">
      <div className="card glass" style={{ textAlign: "center", padding: 32 }}>
        <h1 style={{ fontSize: "var(--fs-display)", fontWeight: 600 }}>404</h1>
        <p style={{ color: "var(--ink-3)", marginTop: 6 }}>
          Seite nicht gefunden
        </p>
        <a
          href="/dashboard"
          className="btn btn--primary"
          style={{ marginTop: 16 }}
        >
          Zur Übersicht
        </a>
      </div>
    </div>
  ),
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="de"
      data-theme="dark"
      data-accent="terracotta"
      className="dark"
      suppressHydrationWarning
    >
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <KerfaPrefsProvider>
      <AuthProvider>
        <TooltipProvider>
          <Outlet />
          <Toaster richColors position="top-right" />
        </TooltipProvider>
      </AuthProvider>
    </KerfaPrefsProvider>
  );
}
