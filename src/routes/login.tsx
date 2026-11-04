import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import {
  KerfaIcon,
  Pill,
  useKerfaPrefs,
} from "@/components/kerfa/KerfaKit";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

const ADMIN_TEST_EMAIL = "admin@tdo-hub.de";
const ADMIN_TEST_PASSWORD = "TDOAdmin2026!";

function LoginPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { backdrop, resolvedTheme, toggleTheme } = useKerfaPrefs();
  const [email, setEmail] = useState(ADMIN_TEST_EMAIL);
  const [password, setPassword] = useState(ADMIN_TEST_PASSWORD);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/dashboard" });
  }, [user, navigate]);

  const signInWithCredentials = async (
    loginEmail: string,
    loginPassword: string
  ) => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Erfolgreich im TDO Provisions-Hub angemeldet.");
      navigate({ to: "/dashboard" });
    }
  };

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    await signInWithCredentials(email, password);
  };

  const handleQuickAdminLogin = async () => {
    setEmail(ADMIN_TEST_EMAIL);
    setPassword(ADMIN_TEST_PASSWORD);
    await signInWithCredentials(ADMIN_TEST_EMAIL, ADMIN_TEST_PASSWORD);
  };

  return (
    <div className="app">
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

      <div className="signin">
        <div className="signin__card glass">
          <div className="signin__in">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <div className="brand">
                <span className="brand__mark">
                  <KerfaIcon name="logo" />
                </span>
                <span className="brand__text">
                  <span className="brand__name">TDO Hub</span>
                  <span className="brand__sub">Provisions-Desk</span>
                </span>
              </div>
              <button
                type="button"
                className="ibtn"
                onClick={toggleTheme}
                title="Design wechseln"
              >
                <KerfaIcon name={resolvedTheme === "dark" ? "sun" : "moon"} />
              </button>
            </div>

            <div style={{ marginBottom: 18 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <Pill tone="ok">Live · WhatsApp &amp; KI-Parser</Pill>
                <Pill tone="accent" dot={false}>
                  11 Anbieter
                </Pill>
              </div>
              <h1
                style={{
                  fontSize: "var(--fs-2xl)",
                  fontWeight: 600,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.15,
                }}
              >
                Im Studio-Desk anmelden
              </h1>
              <p
                style={{
                  fontSize: "var(--fs-sm)",
                  color: "var(--ink-3)",
                  marginTop: 4,
                }}
              >
                Zentrales Vertriebs- &amp; Provisions-CRM für alle 11 Sparten,
                OpenWA-Gruppen-Sync und 12-Blatt Abrechnung.
              </p>
            </div>

            {/* 1-Click Admin Test Access Card */}
            <div
              className="card--well"
              style={{
                padding: 14,
                borderRadius: "var(--r-lg)",
                border: "1px solid var(--line)",
                marginBottom: 18,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: "var(--fs-xs)",
                    fontWeight: 600,
                    color: "var(--accent)",
                  }}
                >
                  <KerfaIcon name="key" size="sm" />
                  Direkter Test-Zugang (Admin)
                </span>
                <span className="badge">Sofort-Login</span>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  gap: "4px 12px",
                  fontSize: "var(--fs-xs)",
                  marginBottom: 12,
                }}
              >
                <span style={{ color: "var(--ink-3)" }}>E-Mail:</span>
                <code className="mono" style={{ color: "var(--ink)" }}>
                  {ADMIN_TEST_EMAIL}
                </code>
                <span style={{ color: "var(--ink-3)" }}>Passwort:</span>
                <code className="mono" style={{ color: "var(--ink)" }}>
                  {ADMIN_TEST_PASSWORD}
                </code>
              </div>
              <button
                type="button"
                className="btn btn--primary btn--block"
                disabled={loading}
                onClick={handleQuickAdminLogin}
              >
                <KerfaIcon name="bolt" size="sm" />
                <span>
                  {loading
                    ? "Anmeldung läuft…"
                    : "Mit 1-Klick als Admin einloggen"}
                </span>
              </button>
            </div>

            <form
              onSubmit={signIn}
              style={{ display: "flex", flexDirection: "column", gap: 12 }}
            >
              <label className="field">
                <span className="field__label">E-Mail-Adresse</span>
                <input
                  type="email"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@tdo-hub.de"
                  required
                />
              </label>

              <label className="field">
                <span className="field__label">Passwort</span>
                <input
                  type="password"
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </label>

              <button
                type="submit"
                className="btn btn--lg btn--block"
                disabled={loading}
                style={{ marginTop: 4 }}
              >
                <span>{loading ? "Wird geprüft…" : "Manuell anmelden"}</span>
                <KerfaIcon name="arrowR" size="sm" />
              </button>
            </form>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 16,
                paddingTop: 14,
                borderTop: "1px solid var(--line)",
                fontSize: "var(--fs-xs)",
                color: "var(--ink-3)",
              }}
            >
              <KerfaIcon name="shield" size="sm" />
              <span>
                Geschützter Bereich — Neue Zugänge werden durch Administratoren
                vergeben.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
