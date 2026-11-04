import {
  createFileRoute,
  Link,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { PROVIDERS } from "@/lib/providers";
import { TDO_GROUP_CHAT_ID } from "@/lib/whatsapp-parser";
import {
  Avatar,
  KerfaIcon,
  type KerfaIconName,
  useKerfaPrefs,
  useSlidingPill,
} from "@/components/kerfa/KerfaKit";
import { toast } from "sonner";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

interface NavItem {
  id: string;
  label: string;
  to: string;
  icon: KerfaIconName;
  match: (pathname: string) => boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: "overview",
    label: "Übersicht",
    to: "/dashboard",
    icon: "home",
    match: (p) => p === "/" || p.startsWith("/dashboard"),
  },
  {
    id: "providers",
    label: "Anbieter & Aufträge",
    to: "/providers/strom",
    icon: "box",
    match: (p) => p.startsWith("/providers"),
  },
  {
    id: "inbox",
    label: "WhatsApp-Eingang",
    to: "/inbox",
    icon: "chat",
    match: (p) => p.startsWith("/inbox"),
  },
  {
    id: "settings",
    label: "Einstellungen",
    to: "/settings",
    icon: "gear",
    match: (p) => p.startsWith("/settings"),
  },
];

function AppLayout() {
  const { user, loading, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { backdrop, resolvedTheme, toggleTheme } = useKerfaPrefs();

  const [finderOpen, setFinderOpen] = useState(false);
  const [finderQuery, setFinderQuery] = useState("");
  const [finderIdx, setFinderIdx] = useState(0);
  const [accountOpen, setAccountOpen] = useState(false);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [syncingWa, setSyncingWa] = useState(false);

  const topNavRef = useRef<HTMLElement>(null);
  const tabBarRef = useRef<HTMLElement>(null);

  const activeNav =
    NAV_ITEMS.find((it) => it.match(location.pathname)) || NAV_ITEMS[0];

  const topPill = useSlidingPill(topNavRef, activeNav.id);
  const tabPill = useSlidingPill(tabBarRef, activeNav.id);

  // Global ⌘K / Ctrl+K shortcut for Finder
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setFinderOpen((v) => !v);
        setFinderQuery("");
        setFinderIdx(0);
      } else if (e.key === "Escape") {
        setFinderOpen(false);
        setAccountOpen(false);
        setNewMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleQuickWaSync = async () => {
    if (syncingWa) return;
    setSyncingWa(true);
    try {
      const res = await fetch("/api/public/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync", chatId: TDO_GROUP_CHAT_ID }),
      });
      const data = await res.json();
      if ((data.newlySynced ?? 0) > 0) {
        toast.success(
          `${data.newlySynced} neue(r) Auftrag/Aufträge aus WhatsApp-Gruppe synchronisiert!`
        );
      } else {
        toast.info(
          `WhatsApp-Gruppe (${TDO_GROUP_CHAT_ID}) ist aktuell (${
            data.scannedMessages ?? 0
          } Nachrichten geprüft).`
        );
      }
    } catch {
      toast.error("Synchronisation mit OpenWA fehlgeschlagen.");
    } finally {
      setSyncingWa(false);
    }
  };

  if (loading) {
    return (
      <div className="app">
        <div className="backdrop" aria-hidden="true">
          <div className="backdrop__layer">
            {backdrop !== "plain" && (
              <img src={`/photos/kerfa/${backdrop}-1600.jpg`} alt="" />
            )}
          </div>
          <div className="backdrop__veil" />
        </div>
        <div className="signin">
          <div
            className="card glass"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "16px 22px",
            }}
          >
            <span className="brand__mark">
              <KerfaIcon name="logo" />
            </span>
            <div>
              <div style={{ fontWeight: 600 }}>TDO Provisions-Hub</div>
              <div className="muted" style={{ fontSize: "var(--fs-xs)" }}>
                Arbeitsbereich wird geladen…
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" />;

  const userName =
    user.user_metadata?.display_name ||
    user.email?.split("@")[0] ||
    "Ghaith Abojamil";

  const finderItems = [
    ...NAV_ITEMS.map((n) => ({
      group: "Ansichten",
      label: n.label,
      sub: n.to,
      icon: n.icon,
      run: () => navigate({ to: n.to }),
    })),
    ...PROVIDERS.map((p) => ({
      group: "Anbieter (11 Sparten)",
      label: `${p.label} — Aufträge & Provisionen`,
      sub: `/providers/${p.path}`,
      icon: "box" as KerfaIconName,
      run: () =>
        navigate({ to: "/providers/$slug", params: { slug: p.path } }),
    })),
    {
      group: "Aktionen",
      label: `WhatsApp-Gruppe (${TDO_GROUP_CHAT_ID}) synchronisieren`,
      sub: "Live OpenWA Sync",
      icon: "refresh" as KerfaIconName,
      run: () => handleQuickWaSync(),
    },
    {
      group: "Aktionen",
      label:
        resolvedTheme === "dark"
          ? "Helles Design aktivieren (Light Mode)"
          : "Dunkles Design aktivieren (Dark Mode)",
      sub: "Erscheinungsbild",
      icon: (resolvedTheme === "dark" ? "sun" : "moon") as KerfaIconName,
      run: () => toggleTheme(),
    },
  ];

  const filteredFinder = finderItems.filter((it) => {
    if (!finderQuery.trim()) return true;
    const q = finderQuery.toLowerCase();
    return (
      it.label.toLowerCase().includes(q) ||
      it.group.toLowerCase().includes(q) ||
      it.sub.toLowerCase().includes(q)
    );
  });

  return (
    <div className="app">
      {/* Kerfa Photo Backdrop + Veil */}
      <div className="backdrop" aria-hidden="true">
        <div className="backdrop__layer">
          {backdrop !== "plain" && (
            <img
              src={`/photos/kerfa/${backdrop}-1600.jpg`}
              srcSet={`/photos/kerfa/${backdrop}-900.jpg 900w, /photos/kerfa/${backdrop}-1600.jpg 1600w`}
              sizes="100vw"
              alt=""
            />
          )}
        </div>
        <div className="backdrop__veil" />
      </div>

      {/* Kerfa Floating Glass Topbar */}
      <header className="top glass">
        <Link to="/dashboard" className="brand">
          <span className="brand__mark">
            <KerfaIcon name="logo" />
          </span>
          <span className="brand__text">
            <span className="brand__name">TDO Hub</span>
            <span className="brand__sub">Provisions-Desk</span>
          </span>
        </Link>

        <span className="top__title">{activeNav.label}</span>

        <nav className="topnav" aria-label="Main" ref={topNavRef}>
          <span
            className="topnav__pill"
            aria-hidden="true"
            style={{
              clipPath: topPill.clipPath,
              opacity: topPill.ready ? 1 : 0,
            }}
          />
          {NAV_ITEMS.map((item) => {
            const isCurrent = item.id === activeNav.id;
            return (
              <Link
                key={item.id}
                to={item.to}
                className="topnav__item"
                aria-current={isCurrent ? "page" : undefined}
                data-pill-active={isCurrent ? "true" : undefined}
              >
                <KerfaIcon name={item.icon} />
                <span className="topnav__label">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="top__tools" style={{ position: "relative" }}>
          <button
            type="button"
            className="searchpill"
            onClick={() => {
              setFinderOpen(true);
              setFinderQuery("");
              setFinderIdx(0);
            }}
            aria-label="Schnellsuche öffnen"
          >
            <KerfaIcon name="search" />
            <span>Suche</span>
            <span className="kbd">⌘K</span>
          </button>

          <button
            type="button"
            className="btn btn--primary top__new"
            onClick={() => {
              setNewMenuOpen((v) => !v);
              setAccountOpen(false);
            }}
          >
            <KerfaIcon name="plus" />
            <span>Sparten</span>
          </button>

          <button
            type="button"
            className="ibtn"
            onClick={toggleTheme}
            title={
              resolvedTheme === "dark"
                ? "Helles Design aktivieren"
                : "Dunkles Design aktivieren"
            }
            aria-label="Design wechseln"
          >
            <KerfaIcon name={resolvedTheme === "dark" ? "sun" : "moon"} />
          </button>

          <button
            type="button"
            className="ibtn"
            onClick={handleQuickWaSync}
            disabled={syncingWa}
            title={`WhatsApp-Gruppe (${TDO_GROUP_CHAT_ID}) jetzt synchronisieren`}
            aria-label="WhatsApp-Gruppe synchronisieren"
          >
            <KerfaIcon name="refresh" />
            <span className="ibtn__badge">WA</span>
          </button>

          <button
            type="button"
            className="me"
            onClick={() => {
              setAccountOpen((v) => !v);
              setNewMenuOpen(false);
            }}
            aria-label="Konto-Menü"
          >
            <Avatar name={userName} size="sm" online />
          </button>

          {/* Quick Sparten & Actions Popover (using exact .menu__item / .menu__label / .menu__sep) */}
          {newMenuOpen && (
            <div
              className="pop"
              style={{
                position: "absolute",
                right: 92,
                top: "calc(100% + 10px)",
                width: 280,
              }}
            >
              <div className="menu__label">Schnellaktionen</div>
              <button
                type="button"
                className="menu__item"
                onClick={() => {
                  setNewMenuOpen(false);
                  handleQuickWaSync();
                }}
              >
                <KerfaIcon name="refresh" />
                <span>WhatsApp-Gruppe synchronisieren</span>
              </button>
              <div className="menu__sep" />
              <div className="menu__label">Alle 11 Anbieter-Sparten</div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 2,
                }}
              >
                {PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="menu__item"
                    onClick={() => {
                      setNewMenuOpen(false);
                      navigate({
                        to: "/providers/$slug",
                        params: { slug: p.path },
                      });
                    }}
                  >
                    <span>{p.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Account Menu Popover */}
          {accountOpen && (
            <div
              className="pop"
              style={{
                position: "absolute",
                right: 0,
                top: "calc(100% + 10px)",
                width: 250,
              }}
            >
              <div className="menu__label">
                {userName} · {isAdmin ? "Admin" : "Mitarbeiter"}
              </div>
              <button
                type="button"
                className="menu__item"
                onClick={() => {
                  setAccountOpen(false);
                  navigate({ to: "/settings" });
                }}
              >
                <KerfaIcon name="swatch" />
                <span>Erscheinungsbild</span>
              </button>
              <button
                type="button"
                className="menu__item"
                onClick={() => {
                  setAccountOpen(false);
                  navigate({ to: "/inbox" });
                }}
              >
                <KerfaIcon name="chat" />
                <span>WhatsApp-Eingang</span>
              </button>
              <div className="menu__sep" />
              <button
                type="button"
                className="menu__item menu__item--danger"
                onClick={() => {
                  setAccountOpen(false);
                  signOut();
                }}
              >
                <KerfaIcon name="logout" />
                <span>Abmelden</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Container */}
      <main className="main" id="main">
        <div className="view">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Tabbar */}
      <nav className="tabbar glass" aria-label="Primary" ref={tabBarRef}>
        <span
          className="tabbar__pill"
          aria-hidden="true"
          style={{
            clipPath: tabPill.clipPath,
            opacity: tabPill.ready ? 1 : 0,
          }}
        />
        {NAV_ITEMS.map((item) => {
          const isCurrent = item.id === activeNav.id;
          return (
            <Link
              key={item.id}
              to={item.to}
              aria-current={isCurrent ? "page" : undefined}
              data-pill-active={isCurrent ? "true" : undefined}
            >
              <KerfaIcon name={item.icon} />
              <span>{item.label.split(" ")[0]}</span>
            </Link>
          );
        })}
      </nav>

      {/* Kerfa Command Finder (⌘K) using exact .finder / .finder__in / .finder__ico */}
      {finderOpen && (
        <>
          <div className="scrim" onClick={() => setFinderOpen(false)} />
          <div
            className="finder"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="finder__in">
              <KerfaIcon name="search" />
              <input
                autoFocus
                value={finderQuery}
                onChange={(e) => {
                  setFinderQuery(e.target.value);
                  setFinderIdx(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setFinderIdx((i) =>
                      Math.min(filteredFinder.length - 1, i + 1)
                    );
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setFinderIdx((i) => Math.max(0, i - 1));
                  } else if (
                    e.key === "Enter" &&
                    filteredFinder[finderIdx]
                  ) {
                    e.preventDefault();
                    filteredFinder[finderIdx].run();
                    setFinderOpen(false);
                  }
                }}
                placeholder="Zu Anbieter, Ansicht oder Aktion springen…"
              />
              <span className="kbd">ESC</span>
            </div>
            <div className="finder__list">
              {filteredFinder.length === 0 ? (
                <div
                  className="muted"
                  style={{
                    padding: 24,
                    textAlign: "center",
                    fontSize: "var(--fs-sm)",
                  }}
                >
                  Keine Treffer für „{finderQuery}“
                </div>
              ) : (
                filteredFinder.map((item, idx) => {
                  const prevGroup =
                    idx > 0 ? filteredFinder[idx - 1].group : null;
                  return (
                    <div key={`${item.group}-${item.label}`}>
                      {item.group !== prevGroup && (
                        <div className="finder__group">{item.group}</div>
                      )}
                      <button
                        type="button"
                        className="finder__item"
                        aria-selected={idx === finderIdx}
                        onMouseEnter={() => setFinderIdx(idx)}
                        onClick={() => {
                          item.run();
                          setFinderOpen(false);
                        }}
                      >
                        <span className="finder__ico">
                          <KerfaIcon name={item.icon} />
                        </span>
                        <div className="cell__text">
                          <b>{item.label}</b>
                          <small>{item.sub}</small>
                        </div>
                        <KerfaIcon name="arrowR" size="sm" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
            <div className="finder__foot">
              <span>
                <kbd className="kbd">↑</kbd> <kbd className="kbd">↓</kbd>{" "}
                Navigieren
              </span>
              <span>
                <kbd className="kbd">↵</kbd> Öffnen
              </span>
              <span>11 Anbieter · Live-WhatsApp</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
