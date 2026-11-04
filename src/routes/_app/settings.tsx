import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  DEFAULT_OPENWA_BASE_URL,
  DEFAULT_OPENWA_SESSION_ID,
  TDO_GROUP_CHAT_ID,
} from "@/lib/whatsapp-parser";
import {
  Avatar,
  KerfaIcon,
  KerfaTabs,
  PageHead,
  Pill,
  Switch,
  useKerfaPrefs,
  type KerfaAccent,
  type KerfaBackdrop,
  type KerfaTheme,
} from "@/components/kerfa/KerfaKit";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

interface MemberRow {
  id: string;
  email: string | null;
  display_name: string | null;
  roles: string[];
}

const ACCENT_OPTIONS: {
  id: KerfaAccent;
  label: string;
  color: string;
}[] = [
  { id: "terracotta", label: "Terracotta", color: "#ad4622" },
  { id: "cobalt", label: "Cobalt", color: "#2450a6" },
  { id: "forest", label: "Forest", color: "#2c6a45" },
  { id: "graphite", label: "Graphite", color: "#2b2825" },
  { id: "amber", label: "Amber", color: "#8f5c08" },
  { id: "teal", label: "Teal", color: "#0c6762" },
  { id: "rose", label: "Rose", color: "#b3325a" },
];

const BACKDROP_OPTIONS: {
  id: KerfaBackdrop;
  label: string;
  img?: string;
}[] = [
  {
    id: "showroom",
    label: "Showroom",
    img: "/photos/kerfa/showroom-900.jpg",
  },
  {
    id: "workshop",
    label: "Atelier",
    img: "/photos/kerfa/workshop-900.jpg",
  },
  {
    id: "plain",
    label: "Minimal",
  },
];

function SettingsPage() {
  const { isAdmin } = useAuth();
  const {
    theme,
    setTheme,
    backdrop,
    setBackdrop,
    accent,
    setAccent,
    solid,
    setSolid,
  } = useKerfaPrefs();

  const [tab, setTab] = useState<"appearance" | "whatsapp" | "users">(
    "appearance"
  );
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [syncing, setSyncing] = useState(false);

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/public/whatsapp`
      : "/api/public/whatsapp";

  const loadMembers = async () => {
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id, email, display_name"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    const map = new Map<string, string[]>();
    (roles ?? []).forEach((r) => {
      const arr = map.get(r.user_id) ?? [];
      arr.push(r.role);
      map.set(r.user_id, arr);
    });
    setMembers(
      (profiles ?? []).map((p) => ({
        id: p.id,
        email: p.email,
        display_name: p.display_name,
        roles: map.get(p.id) ?? [],
      }))
    );
  };

  useEffect(() => {
    if (isAdmin) loadMembers();
  }, [isAdmin]);

  const toggleAdmin = async (userId: string, currentlyAdmin: boolean) => {
    if (currentlyAdmin) {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "admin");
      if (error) toast.error(error.message);
      else toast.success("Admin-Rolle entfernt");
    } else {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: "admin" });
      if (error) toast.error(error.message);
      else toast.success("Zum Admin ernannt");
    }
    loadMembers();
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success("Webhook-URL kopiert");
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/public/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync",
          chatId: TDO_GROUP_CHAT_ID,
          full: true,
        }),
      });
      const data = await res.json();
      toast.success(
        `Synchronisation abgeschlossen: ${
          data.newlySynced ?? 0
        } neue Aufträge (${
          data.scannedMessages ?? 0
        } Gruppennachrichten geprüft).`
      );
    } catch {
      toast.error("Fehler bei der Synchronisation.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div>
      <PageHead
        eyebrow="Kerfa Studio-Konfiguration · System & Rollen"
        title="Einstellungen & Erscheinungsbild"
        sub="Passe das Kerfa-Glasdesign, Hintergrund-Szenen, Akzentfarben, WhatsApp-Anbindung und Benutzerberechtigungen an."
      />

      <KerfaTabs
        value={tab}
        onChange={setTab}
        items={[
          {
            value: "appearance",
            label: "Erscheinungsbild",
            icon: "swatch",
          },
          {
            value: "whatsapp",
            label: "WhatsApp & Webhook",
            icon: "chat",
          },
          {
            value: "users",
            label: "Team & Rollen",
            icon: "users",
            count: members.length || undefined,
          },
        ]}
      />

      {tab === "appearance" && (
        <div className="st-grid">
          {/* Theme Mode Card (exact .st-tiles / .st-tile / .st-tile__art) */}
          <div className="card">
            <div className="chead">
              <div className="chead__text">
                <h2>Farbmodus</h2>
                <p>
                  Wähle zwischen hellem Kerfa-Alabaster, dunklem Espresso-Glas
                  oder Systemautomatik
                </p>
              </div>
              <Pill tone="accent" dot={false}>
                {theme.toUpperCase()}
              </Pill>
            </div>

            <div className="st-tiles">
              {(
                [
                  { id: "light", label: "Hell (Alabaster)", cls: "" },
                  { id: "dark", label: "Dunkel (Studio)", cls: "st-tile--dark" },
                  { id: "system", label: "System", cls: "st-tile--system" },
                ] as { id: KerfaTheme; label: string; cls: string }[]
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={theme === t.id}
                  className={`st-tile ${t.cls}`.trim()}
                  onClick={() => setTheme(t.id)}
                >
                  <span className="st-tile__art">
                    <i />
                    <i />
                    <i />
                  </span>
                  <b>{t.label}</b>
                </button>
              ))}
            </div>
          </div>

          {/* Studio Backdrop Photo Selector (exact .st-tiles / .st-room__art) */}
          <div className="card">
            <div className="chead">
              <div className="chead__text">
                <h2>Studio-Hintergrund (Backdrop)</h2>
                <p>Atmosphärischer Hintergrund hinter den Milchglas-Karten</p>
              </div>
            </div>

            <div className="st-tiles">
              {BACKDROP_OPTIONS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  role="radio"
                  aria-checked={backdrop === b.id}
                  className="st-tile"
                  onClick={() => setBackdrop(b.id)}
                >
                  <span className="st-room__art">
                    {b.img && <img src={b.img} alt={b.label} />}
                    <i />
                  </span>
                  <b>{b.label}</b>
                </button>
              ))}
            </div>
          </div>

          {/* Accent Color Swatches (exact .st-accents / .st-accent) */}
          <div className="card">
            <div className="chead">
              <div className="chead__text">
                <h2>Akzentfarbe</h2>
                <p>Steuert Diagramme, Primär-Buttons, Fokus-Ringe und Badges</p>
              </div>
            </div>

            <div className="st-accents">
              {ACCENT_OPTIONS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  role="radio"
                  aria-checked={accent === a.id}
                  className="st-accent"
                  onClick={() => setAccent(a.id)}
                >
                  <i style={{ background: a.color }}>
                    <KerfaIcon name="check" size="sm" />
                  </i>
                  <span>{a.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Glass / Solid Surface Toggle (exact .row-set) */}
          <div className="card">
            <div className="chead">
              <div className="chead__text">
                <h2>Darstellung &amp; Glas-Effekte</h2>
                <p>Feinabstimmung für Lesbarkeit und Kontrast</p>
              </div>
            </div>

            <div>
              <div className="row-set">
                <div className="row-set__text">
                  <b>Transparenz reduzieren (Solide Karten)</b>
                  <small>
                    Deaktiviert den Milchglas-Blur (`is-solid`) für maximalen
                    Textkontrast
                  </small>
                </div>
                <Switch
                  checked={solid}
                  onChange={setSolid}
                  label="Transparenz reduzieren"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "whatsapp" && (
        <div className="st-grid">
          <div className="card">
            <div className="chead">
              <div className="chead__text">
                <h2>OpenWA WhatsApp-Gruppen-Anbindung</h2>
                <p>
                  Empfängt und sortiert alle Aufträge aus der WhatsApp-Gruppe
                  TDO Provision-Hub
                </p>
              </div>
              <Pill tone="good">Aktiv &amp; Verbunden</Pill>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div className="row-set">
                <div className="row-set__text">
                  <b>WhatsApp Gruppen-ID</b>
                  <small>{TDO_GROUP_CHAT_ID}</small>
                </div>
              </div>
              <div className="row-set">
                <div className="row-set__text">
                  <b>OpenWA Server &amp; Session</b>
                  <small>
                    {DEFAULT_OPENWA_BASE_URL} (
                    {DEFAULT_OPENWA_SESSION_ID.slice(0, 8)}…)
                  </small>
                </div>
              </div>
              <div className="row-set">
                <div className="row-set__text">
                  <b>Neue Tippgeber (VB)</b>
                  <small>Automatische Anlage bei neuen VBs</small>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="btn btn--primary"
              disabled={syncing}
              onClick={handleManualSync}
            >
              <KerfaIcon name="refresh" size="sm" />
              <span>
                {syncing
                  ? "Synchronisiere…"
                  : "Jetzt Gruppe synchronisieren"}
              </span>
            </button>
          </div>

          <div className="card">
            <div className="chead">
              <div className="chead__text">
                <h2>Webhook-Endpunkt (OpenWA &amp; Twilio)</h2>
                <p>
                  Öffentliche HTTP POST / GET Route für eingehende
                  WhatsApp-Events
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <input readOnly className="input" value={webhookUrl} />
              <button
                type="button"
                className="btn btn--primary"
                onClick={copyUrl}
              >
                <KerfaIcon name="copy" size="sm" />
                <span>Kopieren</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "users" && (
        <div className="card card--flush">
          <div className="chead" style={{ paddingBottom: 14 }}>
            <div className="chead__text">
              <h2>Team &amp; Benutzerrollen</h2>
              <p>
                Admins können Datensätze löschen und den WhatsApp-Eingang
                einsehen
              </p>
            </div>
          </div>

          <div className="table-wrap">
            <table className="table table--stack">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>E-Mail</th>
                  <th>Rolle</th>
                  <th className="r">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const isAdminUser = m.roles.includes("admin");
                  return (
                    <tr key={m.id}>
                      <td data-label="Name">
                        <div className="cell">
                          <Avatar
                            name={m.display_name || m.email || "U"}
                            online
                          />
                          <div className="cell__text">
                            <b>{m.display_name ?? m.email}</b>
                          </div>
                        </div>
                      </td>
                      <td data-label="E-Mail" className="muted">
                        {m.email}
                      </td>
                      <td data-label="Rolle">
                        <Pill tone={isAdminUser ? "good" : "plain"}>
                          {isAdminUser ? "Admin" : "Mitarbeiter"}
                        </Pill>
                      </td>
                      <td data-label="Aktion" className="r">
                        <button
                          type="button"
                          className="btn btn--sm"
                          onClick={() => toggleAdmin(m.id, isAdminUser)}
                        >
                          {isAdminUser ? "→ Mitarbeiter" : "→ Admin"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
