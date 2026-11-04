import React, {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// ============================================================================
// 1. KERFA PREFERENCES CONTEXT (Theme, Backdrop, Accent, Solid)
// ============================================================================

export type KerfaTheme = "dark" | "light" | "system";
export type KerfaBackdrop = "showroom" | "workshop" | "plain";
export type KerfaAccent =
  | "terracotta"
  | "cobalt"
  | "forest"
  | "graphite"
  | "amber"
  | "teal"
  | "rose";

interface KerfaPrefsState {
  theme: KerfaTheme;
  resolvedTheme: "dark" | "light";
  backdrop: KerfaBackdrop;
  accent: KerfaAccent;
  solid: boolean;
  setTheme: (t: KerfaTheme) => void;
  toggleTheme: () => void;
  setBackdrop: (b: KerfaBackdrop) => void;
  setAccent: (a: KerfaAccent) => void;
  setSolid: (s: boolean) => void;
}

const KerfaPrefsContext = createContext<KerfaPrefsState | null>(null);

const STORAGE_KEY = "tdo.kerfa.prefs.v2";

export function KerfaPrefsProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<KerfaTheme>("dark");
  const [backdrop, setBackdropState] = useState<KerfaBackdrop>("showroom");
  const [accent, setAccentState] = useState<KerfaAccent>("terracotta");
  const [solid, setSolidState] = useState<boolean>(false);
  const [systemDark, setSystemDark] = useState<boolean>(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.theme) setThemeState(parsed.theme);
        if (parsed.backdrop) setBackdropState(parsed.backdrop);
        if (parsed.accent) setAccentState(parsed.accent);
        if (typeof parsed.solid === "boolean") setSolidState(parsed.solid);
      }
    } catch {
      // ignore
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const resolvedTheme: "dark" | "light" =
    theme === "system" ? (systemDark ? "dark" : "light") : theme;

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", resolvedTheme);
    root.setAttribute("data-accent", accent);
    root.classList.toggle("dark", resolvedTheme === "dark");
    root.classList.toggle("is-solid", solid);
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ theme, backdrop, accent, solid })
      );
    } catch {
      // ignore
    }
  }, [theme, resolvedTheme, backdrop, accent, solid]);

  const value = useMemo<KerfaPrefsState>(
    () => ({
      theme,
      resolvedTheme,
      backdrop,
      accent,
      solid,
      setTheme: setThemeState,
      toggleTheme: () =>
        setThemeState((prev) => {
          const cur = prev === "system" ? (systemDark ? "dark" : "light") : prev;
          return cur === "dark" ? "light" : "dark";
        }),
      setBackdrop: setBackdropState,
      setAccent: setAccentState,
      setSolid: setSolidState,
    }),
    [theme, resolvedTheme, backdrop, accent, solid, systemDark]
  );

  return (
    <KerfaPrefsContext.Provider value={value}>
      {children}
    </KerfaPrefsContext.Provider>
  );
}

export function useKerfaPrefs(): KerfaPrefsState {
  const ctx = useContext(KerfaPrefsContext);
  if (!ctx) {
    return {
      theme: "dark",
      resolvedTheme: "dark",
      backdrop: "showroom",
      accent: "terracotta",
      solid: false,
      setTheme: () => {},
      toggleTheme: () => {},
      setBackdrop: () => {},
      setAccent: () => {},
      setSolid: () => {},
    };
  }
  return ctx;
}

// ============================================================================
// 2. KERFA EXACT SVG ICONS (from kit.js Rs dictionary)
// ============================================================================

export type KerfaIconName =
  | "logo"
  | "home"
  | "kanban"
  | "box"
  | "doc"
  | "building"
  | "chair"
  | "users"
  | "chart"
  | "gear"
  | "help"
  | "search"
  | "plus"
  | "sun"
  | "moon"
  | "monitor"
  | "bell"
  | "check"
  | "close"
  | "chevL"
  | "chevR"
  | "down"
  | "up"
  | "dots"
  | "arrowUp"
  | "arrowDown"
  | "arrowR"
  | "spark"
  | "mail"
  | "phone"
  | "pin"
  | "globe"
  | "calendar"
  | "clock"
  | "tag"
  | "filter"
  | "download"
  | "upload"
  | "copy"
  | "trash"
  | "edit"
  | "eye"
  | "lock"
  | "shield"
  | "key"
  | "link"
  | "ext"
  | "refresh"
  | "bolt"
  | "layers"
  | "grid"
  | "list"
  | "sliders"
  | "send"
  | "chat"
  | "file"
  | "folder"
  | "star"
  | "flag"
  | "truck"
  | "package"
  | "dollar"
  | "card"
  | "percent"
  | "target"
  | "trophy"
  | "alert"
  | "info"
  | "logout"
  | "compass"
  | "swatch"
  | "ruler"
  | "wood"
  | "leather"
  | "fabric"
  | "stone"
  | "metal"
  | "play"
  | "pause"
  | "check2"
  | "minus"
  | "archive"
  | "inbox"
  | "sparkles"
  | "terminal"
  | "book"
  | "coin"
  | "receipt";

export function KerfaIcon({
  name,
  size,
  className = "",
}: {
  name: KerfaIconName;
  size?: "sm" | "lg";
  className?: string;
}) {
  const cls = [
    "ico",
    size === "sm" ? "ico--sm" : size === "lg" ? "ico--lg" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <svg className={cls} viewBox="0 0 24 24" aria-hidden="true">
      {renderIconPath(name)}
    </svg>
  );
}

function renderIconPath(name: KerfaIconName) {
  switch (name) {
    case "logo":
      return (
        <>
          <path d="M6.5 4h11l-2.6 8.5H9.1z" />
          <path d="M4 12.5h16v7H4z" />
        </>
      );
    case "home":
      return (
        <>
          <path d="M3.5 11.5 12 4l8.5 7.5" />
          <path d="M6 10v9.5h12V10" />
        </>
      );
    case "kanban":
      return (
        <>
          <rect x="3.5" y="4.5" width="5" height="15" rx="1.4" />
          <rect x="9.5" y="4.5" width="5" height="10" rx="1.4" />
          <rect x="15.5" y="4.5" width="5" height="13" rx="1.4" />
        </>
      );
    case "box":
      return (
        <>
          <path d="M12 3 4 7.5v9L12 21l8-4.5v-9z" />
          <path d="M4 7.5 12 12l8-4.5" />
          <path d="M12 12v9" />
        </>
      );
    case "doc":
      return (
        <>
          <path d="M6 3.5h8.5L19 8v12.5H6z" />
          <path d="M14 3.5V8h4.5" />
          <path d="M9 12.5h6M9 16h4" />
        </>
      );
    case "building":
      return (
        <>
          <path d="M4.5 20V5.5L13 3.5V20" />
          <path d="M13 9h6.5v11" />
          <path d="M8 8h2M8 11.5h2M8 15h2M16 12.5h1.5M16 16h1.5M3 20h18" />
        </>
      );
    case "chair":
      return (
        <>
          <path d="M7 4.5h10v7H7z" />
          <path d="M5.5 11.5h13v3.5h-13z" />
          <path d="M7 15v5M17 15v5" />
        </>
      );
    case "users":
      return (
        <>
          <circle cx="9.5" cy="8.5" r="3.2" />
          <path d="M3.8 19.5c.6-3.2 3-5 5.7-5s5.1 1.8 5.7 5" />
          <circle cx="16.5" cy="9.5" r="2.4" />
          <path d="M15.5 14.7c2.1.3 3.9 1.8 4.4 4.3" />
        </>
      );
    case "chart":
      return (
        <>
          <path d="M4 19.5h16" />
          <path d="m4.5 15 4.5-4.5 3.5 3 6-7" />
          <path d="M14.5 6.5h4v4" />
        </>
      );
    case "gear":
      return (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </>
      );
    case "help":
      return (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M9.6 9.5a2.5 2.5 0 0 1 4.8.8c0 1.7-2.4 2-2.4 3.4" />
          <circle cx="12" cy="17" r=".6" fill="currentColor" />
        </>
      );
    case "search":
      return (
        <>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4.2 4.2" />
        </>
      );
    case "plus":
      return <path d="M12 5v14M5 12h14" />;
    case "sun":
      return (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.5v2.2M12 19.3v2.2M4.7 4.7l1.6 1.6M17.7 17.7l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.7 19.3l1.6-1.6M17.7 6.3l1.6-1.6" />
        </>
      );
    case "moon":
      return <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />;
    case "monitor":
      return (
        <>
          <rect x="3" y="4" width="18" height="12.5" rx="2" />
          <path d="M8.5 20h7M12 16.5V20" />
        </>
      );
    case "bell":
      return (
        <>
          <path d="M6.5 9.5a5.5 5.5 0 0 1 11 0c0 5 2 6.5 2 6.5h-15s2-1.5 2-6.5" />
          <path d="M10 19a2 2 0 0 0 4 0" />
        </>
      );
    case "check":
      return <path d="m4.5 12.5 5 5 10-10" />;
    case "close":
      return <path d="M6 6l12 12M18 6 6 18" />;
    case "chevL":
      return <path d="m14.5 6-6 6 6 6" />;
    case "chevR":
      return <path d="m9.5 6 6 6-6 6" />;
    case "down":
      return <path d="m6.5 9.5 5.5 5.5 5.5-5.5" />;
    case "up":
      return <path d="m6.5 14.5 5.5-5.5 5.5 5.5" />;
    case "dots":
      return (
        <>
          <circle cx="5.5" cy="12" r="1.3" fill="currentColor" />
          <circle cx="12" cy="12" r="1.3" fill="currentColor" />
          <circle cx="18.5" cy="12" r="1.3" fill="currentColor" />
        </>
      );
    case "arrowUp":
      return <path d="M12 19V5m0 0-5.5 5.5M12 5l5.5 5.5" />;
    case "arrowDown":
      return <path d="M12 5v14m0 0-5.5-5.5M12 19l5.5-5.5" />;
    case "arrowR":
      return <path d="M5 12h14m0 0-5-5m5 5-5 5" />;
    case "spark":
      return <path d="M12 3 14 9l6 2-6 2-2 6-2-6-6-2 6-2z" />;
    case "mail":
      return (
        <>
          <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
          <path d="m4.5 7 7.5 5.5L19.5 7" />
        </>
      );
    case "phone":
      return (
        <path d="M5.5 4.5h3l1.5 4-2 1.5a11 11 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16 16 0 0 1 3.5 6.7 2 2 0 0 1 5.5 4.5z" />
      );
    case "pin":
      return (
        <>
          <path d="M12 21s6.5-6 6.5-11a6.5 6.5 0 1 0-13 0c0 5 6.5 11 6.5 11z" />
          <circle cx="12" cy="10" r="2.3" />
        </>
      );
    case "globe":
      return (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M3.6 12h16.8M12 3.5c2.6 2.7 2.6 14.3 0 17M12 3.5c-2.6 2.7-2.6 14.3 0 17" />
        </>
      );
    case "calendar":
      return (
        <>
          <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
          <path d="M8 3.5v3M16 3.5v3M3.5 9.5h17" />
        </>
      );
    case "clock":
      return (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5V12l3.2 2" />
        </>
      );
    case "tag":
      return (
        <>
          <path d="M3.5 12V4.5H11l9 9-7.5 7.5z" />
          <circle cx="8" cy="8" r="1.2" fill="currentColor" />
        </>
      );
    case "filter":
      return <path d="M4 6h16M7 12h10M10 18h4" />;
    case "download":
      return (
        <>
          <path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5" />
          <path d="M4.5 19.5h15" />
        </>
      );
    case "upload":
      return (
        <>
          <path d="M12 15V4m0 0-4.5 4.5M12 4l4.5 4.5" />
          <path d="M4.5 19.5h15" />
        </>
      );
    case "copy":
      return (
        <>
          <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
          <path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" />
        </>
      );
    case "trash":
      return (
        <>
          <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.8 12.5a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4L17.5 7" />
        </>
      );
    case "edit":
      return <path d="M15.5 4.5 19.5 8.5 8 20H4v-4z" />;
    case "eye":
      return (
        <>
          <path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" />
          <circle cx="12" cy="12" r="2.8" />
        </>
      );
    case "lock":
      return (
        <>
          <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
          <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
        </>
      );
    case "shield":
      return (
        <path d="M12 3 4.5 6v5.8c0 5 3.2 8.4 7.5 9.7 4.3-1.3 7.5-4.7 7.5-9.7V6z" />
      );
    case "key":
      return (
        <>
          <circle cx="8" cy="15" r="4" />
          <path d="m11 12 8.5-8.5M16 6l2.5 2.5M18.5 3.5 21 6" />
        </>
      );
    case "link":
      return (
        <>
          <path d="M10 14a4.5 4.5 0 0 0 6.4 0l2.8-2.8a4.5 4.5 0 0 0-6.4-6.4L11 6.5" />
          <path d="M14 10a4.5 4.5 0 0 0-6.4 0L4.8 12.8a4.5 4.5 0 0 0 6.4 6.4l1.7-1.7" />
        </>
      );
    case "ext":
      return (
        <>
          <path d="M14 4h6v6M20 4l-8.5 8.5" />
          <path d="M19 13.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5.5" />
        </>
      );
    case "refresh":
      return (
        <>
          <path d="M20 11A8 8 0 0 0 5.3 6.3L4 8m0-4v4h4" />
          <path d="M4 13a8 8 0 0 0 14.7 4.7L20 16m0 4v-4h-4" />
        </>
      );
    case "bolt":
      return <path d="M13 3 5 14h6l-1 7 8-11h-6z" />;
    case "layers":
      return (
        <>
          <path d="m12 3 9 5-9 5-9-5z" />
          <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
        </>
      );
    case "grid":
      return (
        <>
          <rect x="4" y="4" width="6.5" height="6.5" rx="1.4" />
          <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.4" />
          <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.4" />
          <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.4" />
        </>
      );
    case "list":
      return <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />;
    case "sliders":
      return (
        <>
          <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
          <circle cx="15" cy="7" r="2" />
          <circle cx="9" cy="17" r="2" />
        </>
      );
    case "send":
      return <path d="m3.5 11.5 17-7-7 17-2.5-7.5z" />;
    case "chat":
      return (
        <path d="M4.5 6.5A2.5 2.5 0 0 1 7 4h10a2.5 2.5 0 0 1 2.5 2.5v7A2.5 2.5 0 0 1 17 16H9l-4.5 3.5z" />
      );
    case "file":
      return (
        <>
          <path d="M6 3.5h8L18.5 8v12.5H6z" />
          <path d="M14 3.5V8h4.5" />
        </>
      );
    case "folder":
      return <path d="M3.5 6.5h6l2 2.5h9v10h-17z" />;
    case "star":
      return (
        <path d="m12 3.5 2.6 5.4 6 .8-4.3 4.2 1 6-5.3-2.8-5.3 2.8 1-6L3.4 9.7l6-.8z" />
      );
    case "flag":
      return <path d="M5 21V4h13l-2.5 4.5L18 13H5" />;
    case "truck":
      return (
        <>
          <path d="M3 6.5h11v9H3zM14 9.5h4l3 3.5v2.5h-7z" />
          <circle cx="7.5" cy="17.5" r="2" />
          <circle cx="17.5" cy="17.5" r="2" />
        </>
      );
    case "package":
      return (
        <>
          <path d="M12 3 4 7v10l8 4 8-4V7z" />
          <path d="m4 7 8 4 8-4M12 11v10M8 5l8 4" />
        </>
      );
    case "dollar":
      return (
        <path d="M12 3v18M16 7.5c0-1.7-1.8-3-4-3s-4 1.3-4 3 1.5 2.4 4 3 4 1.3 4 3-1.8 3-4 3-4-1.3-4-3" />
      );
    case "card":
      return (
        <>
          <rect x="3" y="5.5" width="18" height="13" rx="2" />
          <path d="M3 10h18M7 15h4" />
        </>
      );
    case "percent":
      return (
        <>
          <path d="M19 5 5 19" />
          <circle cx="7.5" cy="7.5" r="2.2" />
          <circle cx="16.5" cy="16.5" r="2.2" />
        </>
      );
    case "target":
      return (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1.8" fill="currentColor" />
        </>
      );
    case "trophy":
      return (
        <>
          <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
          <path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M12 14v5M8.5 19.5h7" />
        </>
      );
    case "alert":
      return (
        <>
          <path d="M12 3.5 2.8 19.5h18.4z" />
          <path d="M12 10v4.5" />
          <circle cx="12" cy="17" r=".7" fill="currentColor" />
        </>
      );
    case "info":
      return (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 11v5.5" />
          <circle cx="12" cy="8" r=".7" fill="currentColor" />
        </>
      );
    case "logout":
      return (
        <>
          <path d="M9 20H5a1.5 1.5 0 0 1-1.5-1.5v-13A1.5 1.5 0 0 1 5 4h4" />
          <path d="m15 16 4.5-4L15 8M9.5 12h10" />
        </>
      );
    case "compass":
      return (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="m15.5 8.5-2 5-5 2 2-5z" />
        </>
      );
    case "swatch":
      return (
        <>
          <rect x="4" y="3.5" width="6.5" height="15" rx="2" />
          <path d="M10.5 7.5 15 4l4 4-6.5 8" />
          <path d="M9 18.5h10.5v2H8" />
        </>
      );
    case "ruler":
      return (
        <>
          <path d="M3.5 16.5 16.5 3.5l4 4-13 13z" />
          <path d="m13 7 2 2M10 10l2 2M7 13l2 2" />
        </>
      );
    case "wood":
      return (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="2" />
        </>
      );
    case "leather":
      return (
        <path d="M6 3.5c2 1.5 4 1.5 6 0 2 1.5 4 1.5 6 0l2 4c-1.5 2-1.5 7 0 9l-2 4c-2-1.5-4-1.5-6 0-2-1.5-4-1.5-6 0l-2-4c1.5-2 1.5-7 0-9z" />
      );
    case "fabric":
      return (
        <path d="M4 6h16M4 10h16M4 14h16M4 18h16M7 3.5v17M12 3.5v17M17 3.5v17" />
      );
    case "stone":
      return <path d="m6 4.5 7-1 6.5 4.5 1 7.5-5.5 5-9.5-1L3 13z" />;
    case "metal":
      return (
        <>
          <path d="m12 3 8.5 5v8L12 21l-8.5-5V8z" />
          <path d="m5 9 14 6" />
        </>
      );
    case "play":
      return <path d="m7 5 12 7-12 7z" />;
    case "pause":
      return <path d="M7.5 5h3v14h-3zM13.5 5h3v14h-3z" />;
    case "check2":
      return (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="m8.5 12.2 2.5 2.5 5-5" />
        </>
      );
    case "minus":
      return <path d="M5 12h14" />;
    case "archive":
      return (
        <>
          <rect x="3.5" y="4.5" width="17" height="4" rx="1" />
          <path d="M5 8.5v10a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5v-10M10 12.5h4" />
        </>
      );
    case "inbox":
      return (
        <>
          <path d="M3.5 13.5 6 5h12l2.5 8.5v5.5h-17z" />
          <path d="M3.5 13.5h5l1.5 2.5h4l1.5-2.5h5" />
        </>
      );
    case "sparkles":
      return (
        <>
          <path d="M12 3 13.8 8.2 19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
          <path d="M18.5 15.5 19.3 18l2.5.8-2.5.8-.8 2.5-.8-2.5-2.5-.8 2.5-.8z" />
        </>
      );
    case "terminal":
      return (
        <>
          <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
          <path d="m7.5 9.5 3 2.5-3 2.5M12.5 14.5h4" />
        </>
      );
    case "book":
      return (
        <path d="M5 4.5h11a2.5 2.5 0 0 1 2.5 2.5v12.5H7.5A2.5 2.5 0 0 1 5 17V4.5zm0 12.5A2.5 2.5 0 0 1 7.5 14.5H18.5" />
      );
    case "coin":
      return (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7v10M9.5 9.5c0-1.1 1.1-2 2.5-2s2.5.9 2.5 2-1 1.6-2.5 2-2.5.9-2.5 2 1.1 2 2.5 2 2.5-.9 2.5-2" />
        </>
      );
    case "receipt":
      return (
        <>
          <path d="M5.5 3.5h13v17l-2.2-1.5-2.1 1.5-2.2-1.5-2.2 1.5-2.1-1.5-2.2 1.5z" />
          <path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4.5" />
        </>
      );
  }
}

// ============================================================================
// 3. SLIDING PILL CLIP-PATH HOOK (from kit.js xo)
// ============================================================================

export function useSlidingPill(
  containerRef: React.RefObject<HTMLElement | null>,
  activeKey: string | number
) {
  const [clipPath, setClipPath] = useState<string>(
    "inset(0 100% 0 0 round 99px)"
  );
  const [ready, setReady] = useState(false);

  const update = () => {
    const root = containerRef.current;
    if (!root) return;
    const activeEl = root.querySelector<HTMLElement>(
      '[data-pill-active="true"], [aria-current="page"], [aria-pressed="true"]'
    );
    if (!activeEl) {
      setReady(false);
      return;
    }
    const cw = root.clientWidth;
    const ch = root.clientHeight;
    if (!cw || !ch) return;
    const l = activeEl.offsetLeft;
    const t = activeEl.offsetTop;
    const r = Math.max(0, cw - l - activeEl.offsetWidth);
    const b = Math.max(0, ch - t - activeEl.offsetHeight);
    setClipPath(`inset(${t}px ${r}px ${b}px ${l}px round 99px)`);
    setReady(true);
  };

  useLayoutEffect(() => {
    update();
    const root = containerRef.current;
    if (!root || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => update());
    ro.observe(root);
    return () => ro.disconnect();
  }, [activeKey]);

  return { clipPath, ready };
}

// ============================================================================
// 4. AVATAR, PILL, DELTA, LEVEL BAR
// ============================================================================

const AVATAR_PALETTE = [
  ["#f0d9c4", "#7a3b1e"],
  ["#cfe3df", "#1b5951"],
  ["#e8dfc2", "#5d4a14"],
  ["#d3dceb", "#233c63"],
  ["#efd3d1", "#6b2622"],
  ["#dcd9cf", "#3f3b32"],
];

export function Avatar({
  name = "?",
  size,
  tone,
  online,
}: {
  name?: string;
  size?: "xs" | "sm" | "lg" | "xl";
  tone?: number;
  online?: boolean;
  square?: boolean;
}) {
  const initials =
    name
      .split(/[\s,._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() || "")
      .join("") || "?";

  const idx =
    (tone ??
      name.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0)) %
    AVATAR_PALETTE.length;
  const [bg, fg] = AVATAR_PALETTE[Math.abs(idx)];

  const cls = [
    "av",
    size === "xs" ? "av--sm" : size ? `av--${size}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={cls} style={{ background: bg, color: fg }} title={name}>
      {initials}
      {online && <i className="av__dot" />}
    </span>
  );
}

export type KerfaTone =
  | "ok"
  | "good"
  | "warn"
  | "bad"
  | "info"
  | "accent"
  | "neutral"
  | "plain";

export function Pill({
  tone = "neutral",
  dot = true,
  style,
  children,
}: {
  tone?: KerfaTone;
  dot?: boolean;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const mappedTone =
    tone === "ok"
      ? "good"
      : tone === "neutral" || tone === "plain"
        ? ""
        : tone;
  const cls = [
    "pill",
    mappedTone ? `pill--${mappedTone}` : "",
    !dot ? "pill--plain" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={cls} style={style}>
      {children}
    </span>
  );
}

export function Delta({
  value,
  suffix = "%",
  note,
}: {
  value: number;
  suffix?: string;
  note?: string;
}) {
  const up = value >= 0;
  return (
    <span className={`delta ${up ? "delta--up" : "delta--down"}`}>
      <KerfaIcon name={up ? "arrowUp" : "arrowDown"} size="sm" />
      {up ? "+" : ""}
      {value.toFixed(1)}
      {suffix}
      {note && <em>{note}</em>}
    </span>
  );
}

export function LevelBar({
  value = 0,
  max = 100,
  tone,
}: {
  value: number;
  max?: number;
  tone?: "ok" | "good" | "warn" | "bad";
}) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  const mapped = tone === "ok" ? "good" : tone;
  return (
    <div className={`level ${mapped ? `level--${mapped}` : ""}`.trim()}>
      <i
        style={{
          transform: `scaleX(${pct / 100})`,
          transition: "transform 0.7s cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      />
    </div>
  );
}

// ============================================================================
// 5. SPARKLINE & AREA CHART (Exact Kerfa SVG geometry from kit.js & charts.js)
// ============================================================================

export function Sparkline({
  points = [],
  tone,
  className = "",
}: {
  points: number[];
  tone?: "ok" | "good" | "bad";
  className?: string;
}) {
  if (!points.length) return null;
  const w = 92;
  const h = 30;
  const p = 3;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const coords = points.map((v, idx) => [
    p + (idx / Math.max(1, points.length - 1)) * (w - p * 2),
    h - p - ((v - min) / span) * (h - p * 2),
  ]);
  const d = coords.reduce((acc, [x, y], idx, arr) => {
    if (idx === 0) return `M${x.toFixed(1)},${y.toFixed(1)}`;
    const [px, py] = arr[idx - 1];
    const cx = ((px + x) / 2).toFixed(1);
    return `${acc} C${cx},${py.toFixed(1)} ${cx},${y.toFixed(1)} ${x.toFixed(1)},${y.toFixed(1)}`;
  }, "");
  const area = `${d} L${coords[coords.length - 1][0].toFixed(1)},${h} L${coords[0][0].toFixed(1)},${h} Z`;
  const color =
    tone === "ok" || tone === "good"
      ? "var(--good)"
      : tone === "bad"
        ? "var(--bad)"
        : "var(--accent)";

  return (
    <svg
      className={`spark ${className}`.trim()}
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{ color }}
      aria-hidden="true"
    >
      <path className="spark__area" d={area} />
      <path d={d} />
    </svg>
  );
}

function buildSmoothCurve(pts: [number, number][]): string {
  return pts.reduce((acc, [x, y], idx) => {
    if (idx === 0) return `M${x.toFixed(1)},${y.toFixed(1)}`;
    const [px, py] = pts[idx - 1];
    const cx = ((px + x) / 2).toFixed(1);
    return `${acc} C${cx},${py.toFixed(1)} ${cx},${y.toFixed(1)} ${x.toFixed(1)},${y.toFixed(1)}`;
  }, "");
}

export function AreaChart({
  series = [],
  compare = [],
  labels = [],
  height = 220,
  format = (v: number) => `${v.toLocaleString("de-DE")} €`,
}: {
  series: number[];
  compare?: number[];
  labels: string[];
  height?: number;
  format?: (v: number) => string;
  seriesLabel?: string;
  compareLabel?: string;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const w = 640;
  const h = height;
  const padX = 8;
  const padT = 14;
  const padB = 26;

  const allValues = [...series, ...compare];
  const min = Math.min(0, ...allValues);
  const max = Math.max(...allValues) * 1.05 || 1;
  const span = max - min || 1;

  const toPoints = (arr: number[]): [number, number][] =>
    arr.map((v, idx) => [
      padX + (idx / Math.max(1, arr.length - 1)) * (w - padX * 2),
      h - padB - ((v - min) / span) * (h - padT - padB),
    ]);

  const pts = toPoints(series);
  const cmpPts = compare.length ? toPoints(compare) : [];
  const line = buildSmoothCurve(pts);
  const area = pts.length
    ? `${line} L${pts[pts.length - 1][0].toFixed(1)},${h - padB} L${pts[0][0].toFixed(1)},${h - padB} Z`
    : "";
  const cmpLine = cmpPts.length ? buildSmoothCurve(cmpPts) : "";

  const ticks = [1, 0.5, 0].map((t) => Math.round(min + span * t));

  return (
    <div
      className="area"
      style={{ height: h }}
      onMouseMove={(e) => {
        if (!pts.length) return;
        const svgEl = e.currentTarget.querySelector("svg");
        if (!svgEl) return;
        const rect = svgEl.getBoundingClientRect();
        const rel = Math.max(
          0,
          Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width))
        );
        setHoverIdx(Math.round(rel * (pts.length - 1)));
      }}
      onMouseLeave={() => setHoverIdx(null)}
    >
      <div className="area__grid" style={{ top: padT, bottom: padB }}>
        {ticks.map((tv, idx) => (
          <div key={idx}>
            <span>{format(tv)}</span>
          </div>
        ))}
      </div>
      <svg
        className="area__svg"
        width="100%"
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="kerfaAreaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.34" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {cmpLine && <path className="area__cmp" d={cmpLine} />}
        {area && <path d={area} fill="url(#kerfaAreaFill)" />}
        {line && <path className="area__line" d={line} />}
        {hoverIdx !== null && pts[hoverIdx] && (
          <g>
            <line
              x1={pts[hoverIdx][0]}
              x2={pts[hoverIdx][0]}
              y1={padT}
              y2={h - padB}
              className="area__cursor"
            />
            <circle
              cx={pts[hoverIdx][0]}
              cy={pts[hoverIdx][1]}
              r="5"
              className="area__dot"
            />
          </g>
        )}
      </svg>
      <div className="area__x">
        {labels.map((lb, idx) => (
          <span
            key={idx}
            style={{
              left: `${(idx / Math.max(1, labels.length - 1)) * 100}%`,
            }}
          >
            {lb}
          </span>
        ))}
      </div>
      {hoverIdx !== null && pts[hoverIdx] && (
        <div
          className="charttip"
          style={{
            left: `calc(48px + (100% - 48px) * ${
              hoverIdx / Math.max(1, pts.length - 1)
            })`,
            top: Math.max(4, pts[hoverIdx][1] - 46),
          }}
        >
          <b>{format(series[hoverIdx])}</b>
          <small>
            {labels[hoverIdx]}
            {compare[hoverIdx] != null
              ? ` · Basis ${format(compare[hoverIdx])}`
              : ""}
          </small>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 6. SEGMENTED CONTROL, TABS, CHIPS, SEARCH INPUT, SWITCH, PAGE HEAD
// ============================================================================

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (val: T) => void;
  options: { value: T; label: string; icon?: KerfaIconName; count?: number }[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { clipPath, ready } = useSlidingPill(ref, value);

  return (
    <div className="seg" role="group" ref={ref}>
      <span
        className="seg__thumb"
        aria-hidden="true"
        style={{ clipPath, opacity: ready ? 1 : 0 }}
      />
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            data-pill-active={active ? "true" : undefined}
            onClick={() => onChange(o.value)}
          >
            {o.icon && <KerfaIcon name={o.icon} size="sm" />}
            <span>{o.label}</span>
            {o.count != null && <span className="badge">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function KerfaTabs<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (val: T) => void;
  items: { value: T; label: string; count?: number; icon?: KerfaIconName }[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { clipPath, ready } = useSlidingPill(ref, value);

  return (
    <div className="tabs" role="tablist" ref={ref}>
      <span
        className="tabs__pill"
        aria-hidden="true"
        style={{ clipPath, opacity: ready ? 1 : 0 }}
      />
      {items.map((it) => {
        const active = value === it.value;
        return (
          <button
            key={it.value}
            type="button"
            role="tab"
            aria-current={active ? "page" : undefined}
            data-pill-active={active ? "true" : undefined}
            onClick={() => onChange(it.value)}
          >
            {it.icon && <KerfaIcon name={it.icon} size="sm" />}
            <span>{it.label}</span>
            {it.count != null && <span className="badge">{it.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Chips<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (val: T) => void;
  items: { value: T; label: string; dot?: string; count?: number }[];
}) {
  return (
    <div className="chips">
      {items.map((it) => {
        const active = value === it.value;
        return (
          <button
            key={it.value}
            type="button"
            className="chip"
            aria-pressed={active}
            onClick={() => onChange(it.value)}
          >
            {it.dot && (
              <i
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: it.dot,
                }}
              />
            )}
            <span>{it.label}</span>
            {it.count != null && <span className="badge">{it.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Suchen…",
  width = 240,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  width?: number | string;
}) {
  return (
    <div className="inwrap" style={{ width }}>
      <KerfaIcon name="search" />
      <input
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="switch"
      onClick={() => onChange(!checked)}
    >
      <i />
    </button>
  );
}

export function PageHead({
  eyebrow,
  title,
  sub,
  actions,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  sub?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="phead">
      <div className="phead__text">
        {eyebrow && (
          <span className="phead__eyebrow">
            <i />
            {eyebrow}
          </span>
        )}
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {actions && <div className="phead__actions">{actions}</div>}
    </header>
  );
}

export function EmptyState({
  icon = "inbox",
  title = "Keine Einträge",
  sub,
  action,
}: {
  icon?: KerfaIconName;
  title?: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty__icon">
        <KerfaIcon name={icon} />
      </div>
      <b>{title}</b>
      {sub && <p>{sub}</p>}
      {action}
    </div>
  );
}

// ============================================================================
// 7. KERFA SLIDE-OVER DRAWER & MODAL
// ============================================================================

export function KerfaDrawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" aria-modal="true" role="dialog">
        <header className="drawer__head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            type="button"
            className="ibtn ibtn--sm"
            onClick={onClose}
            aria-label="Schließen"
          >
            <KerfaIcon name="close" size="sm" />
          </button>
        </header>
        <div className="drawer__body">{children}</div>
        {footer && <footer className="drawer__foot">{footer}</footer>}
      </aside>
    </>
  );
}

export function KerfaModal({
  open,
  onClose,
  title,
  subtitle,
  maxWidth = 620,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  maxWidth?: number;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="modal-wrap" onClick={onClose}>
        <div
          className="modal"
          style={{ width: `min(${maxWidth}px, 100%)` }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <header className="modal__head">
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2>{title}</h2>
              {subtitle && <p>{subtitle}</p>}
            </div>
            <button
              type="button"
              className="ibtn ibtn--sm"
              onClick={onClose}
              aria-label="Schließen"
            >
              <KerfaIcon name="close" size="sm" />
            </button>
          </header>
          <div className="modal__body">{children}</div>
          {footer && <footer className="modal__foot">{footer}</footer>}
        </div>
      </div>
    </>
  );
}
