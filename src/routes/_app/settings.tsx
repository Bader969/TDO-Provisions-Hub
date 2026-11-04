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
  { id: "terracotta", label: "Terracotta", color: "#e06538" },
  { id: "cobalt", label: "Cobalt", color: "#2d64e6" },
  { id: "forest", label: "Forest", color: "#1e7a52" },
  { id: "graphite", label: "Graphite", color: "#525866" },
  { id: "amber", label: "Amber", color: "#d48518" },
  { id: "teal", label: "Teal", color: "#157f8c" },
  { id: "rose", label: "Rose", color: "#c93b6b" },
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
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageHead
        eyebrow="Kerfa Studio-Konfiguration · System & Rollen"
        title="Einstellungen & Erscheinungsbild"
        sub="Passe das Kerfa-Glasdesign, Hintergrund-Szenen, Akzentfarben, WhatsApp-Anbindung und Benutzerberechtigungen an."
        actions={
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
        }
      />

      {tab === "appearance" && (
        <div className="st-grid">
          <div className="st-col">
            <div className="card">
              <div className="chead">
                <div>
                  <div className="chead__title">Farbmodus</div>
                  <div className="chead__sub">
                    Wähle zwischen hellem Kerfa-Alabaster, dunklem Espresso-Glas
                    oder Systemautomatik
                  </div>
                </div>
                <Pill tone="accent" dot={false}>
                  {theme.toUpperCase()}
                </Pill>
              </div>

              <div className="st-tiles">
                {(
                  [
                    { id: "light", label: "Hell (Alabaster)" },
                    { id: "dark", label: "Dunkel (Studio)" },
                    { id: "system", label: "System" },
                  ] as { id: KerfaTheme; label: string }[]
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`st-tile ${theme === t.id ? "is-on" : ""}`}
                    onClick={() => setTheme(t.id)}
                  >
                    <div className={`st-tile__prev st-tile__prev--${t.id}`}>
                      <span />
                      <i />
                      <b />
                    </div>
                    <div className="st-tile__lbl">{t.label}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="chead">
                <div>
                  <div className="chead__title">
                    Studio-Hintergrund (Backdrop)
                  </div>
                  <div className="chead__sub">
                    Atmosphärischer Hintergrund hinter den Milchglas-Karten
                  </div>
                </div>
              </div>

              <div className="st-room">
                {BACKDROP_OPTIONS.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    className={`st-room__opt ${
                      backdrop === b.id ? "is-on" : ""
                    }`}
                    onClick={() => setBackdrop(b.id)}
                  >
                    {b.img ? (
                      <img src={b.img} alt={b.label} />
                    ) : (
                      <div className="st-room__plain" />
                    )}
                    <span>{b.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="st-col">
            <div className="card">
              <div className="chead">
                <div>
                  <div className="chead__title">Akzentfarbe</div>
                  <div className="chead__sub">
                    Steuert Diagramme, Primär-Buttons, Fokus-Ringe und Badges
                  </div>
                </div>
              </div>

              <div className="st-accents">
                {ACCENT_OPTIONS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className={`st-accent ${accent === a.id ? "is-on" : ""}`}
                    onClick={() => setAccent(a.id)}
                  >
                    <i style={{ background: a.color }} />
                    <span>{a.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="chead">
                <div>
                  <div className="chead__title">
                    Darstellung &amp; Glas-Effekte
                  </div>
                  <div className="chead__sub">
                    Feinabstimmung für Lesbarkeit und Kontrast
                  </div>
                </div>
              </div>

              <div className="st-list">
                <div className="st-row">
                  <div>
                    <div className="st-row__title">
                      Transparenz reduzieren (Solide Karten)
                    </div>
                    <div className="st-row__sub">
                      Deaktiviert den Milchglas-Blur (`is-solid`) für maximalen
                      Textkontrast
                    </div>
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
        </div>
      )}

      {tab === "whatsapp" && (
        <div className="st-grid">
          <div className="card">
            <div className="chead">
              <div>
                <div className="chead__title">
                  OpenWA WhatsApp-Gruppen-Anbindung
                </div>
                <div className="chead__sub">
                  Empfängt und sortiert alle Aufträge aus der WhatsApp-Gruppe
                  TDO Provision-Hub
                </div>
              </div>
              <Pill tone="ok">Aktiv &amp; Verbunden</Pill>
            </div>

            <div className="kv" style={{ marginBottom: 14 }}>
              <div>
                <dt>WhatsApp Gruppen-ID</dt>
                <dd className="mono">{TDO_GROUP_CHAT_ID}</dd>
              </div>
              <div>
                <dt>OpenWA Server &amp; Session</dt>
                <dd className="mono">
                  {DEFAULT_OPENWA_BASE_URL} (
                  {DEFAULT_OPENWA_SESSION_ID.slice(0, 8)}…)
                </dd>
              </div>
              <div>
                <dt>Neue Tippgeber (VB)</dt>
                <dd>Automatische Anlage bei neuen VBs</dd>
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
              <div>
                <div className="chead__title">
                  Webhook-Endpunkt (OpenWA &amp; Twilio)
                </div>
                <div className="chead__sub">
                  Öffentliche HTTP POST / GET Route für eingehende
                  WhatsApp-Events
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input readOnly className="input mono" value={webhookUrl} />
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
          <div className="chead">
            <div>
              <div className="chead__title">Team &amp; Benutzerrollen</div>
              <div className="chead__sub">
                Admins können Datensätze löschen und den WhatsApp-Eingang
                einsehen
              </div>
            </div>
          </div>

          <div className="table-wrap">
            <table className="table table--cards">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>E-Mail</th>
                  <th>Rolle</th>
                  <th className="num">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const isAdminUser = m.roles.includes("admin");
                  return (
                    <tr key={m.id}>
                      <td data-label="Name">
                        <div className="row-title">
                          <Avatar
                            name={m.display_name || m.email || "U"}
                            size="sm"
                            online
                          />
                          <div className="row-title__text">
                            <span className="row-title__main">
                              {m.display_name ?? m.email}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td data-label="E-Mail" className="mono">
                        {m.email}
                      </td>
                      <td data-label="Rolle">
                        <Pill tone={isAdminUser ? "ok" : "neutral"}>
                          {isAdminUser ? "Admin" : "Mitarbeiter"}
                        </Pill>
                      </td>
                      <td data-label="Aktion" className="num">
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
