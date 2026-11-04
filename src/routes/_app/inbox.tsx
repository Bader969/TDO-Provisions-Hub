import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { TDO_GROUP_CHAT_ID } from "@/lib/whatsapp-parser";
import {
  Avatar,
  EmptyState,
  KerfaIcon,
  PageHead,
  Pill,
} from "@/components/kerfa/KerfaKit";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/inbox")({
  component: InboxPage,
});

const SAMPLE_MESSAGE = `Strom Auftrag
VB: Ghaith Abojamil
Kunde: Matthias Lindner
Auftragsnr: STR-2026-99412
Tarif: E.ON ÖkoStrom 24
Zählernummer: 1ESY116049221
Verbrauch: 3.400 kWh
Provision: 95,00 €`;

function InboxPage() {
  const { isAdmin } = useAuth();
  const [msgs, setMsgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [senderName, setSenderName] = useState("Ghaith Abojamil");
  const [messageBody, setMessageBody] = useState(SAMPLE_MESSAGE);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("raw_messages")
      .select("*")
      .order("received_at", { ascending: false })
      .limit(200);
    if (error) toast.error(error.message);
    else setMsgs(data ?? []);
    setLoading(false);
  }, []);

  const syncOpenWa = async () => {
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
      if ((data.newlySynced ?? 0) > 0) {
        toast.success(
          `${data.newlySynced} neue(r) Auftrag/Aufträge aus WhatsApp-Gruppe synchronisiert!`
        );
      } else {
        toast.info(
          `Alle ${
            data.scannedMessages ?? 0
          } Nachrichten aus ${TDO_GROUP_CHAT_ID} sind bereits synchronisiert.`
        );
      }
      await load();
    } catch {
      toast.error("Fehler bei der OpenWA-Synchronisation");
    } finally {
      setSyncing(false);
    }
  };

  const handleSimulateMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageBody.trim()) return;
    setSendingTest(true);
    try {
      const res = await fetch("/api/public/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "onMessage",
          data: {
            id: `sim_${Date.now()}`,
            chatId: TDO_GROUP_CHAT_ID,
            body: messageBody,
            sender: {
              pushname: senderName || "Ghaith Abojamil",
              id: "49176000000@c.us",
            },
            t: Math.floor(Date.now() / 1000),
          },
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(
          `Nachricht verarbeitet (${data.inserted ?? 1} Auftrag gespeichert)!`
        );
        await load();
      } else {
        toast.error(data.error || "Verarbeitung fehlgeschlagen");
      }
    } catch (err: any) {
      toast.error(err?.message || "Fehler beim Senden");
    } finally {
      setSendingTest(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    load();
    const channel = supabase
      .channel("inbox")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "raw_messages" },
        load
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, load]);

  if (!isAdmin) {
    return (
      <EmptyState
        icon="lock"
        title="Nur für Administratoren"
        sub="Der WhatsApp-Eingang ist für Administratoren freigeschaltet."
      />
    );
  }

  const processedCount = msgs.filter(
    (m) => m.processed && !m.parse_error
  ).length;
  const errorCount = msgs.filter((m) => m.parse_error).length;

  return (
    <div>
      <PageHead
        eyebrow={`Live OpenWA Bridge · Gruppe ${TDO_GROUP_CHAT_ID} · KI- & Regel-Parser`}
        title="WhatsApp-Eingang & Auftrags-Parser"
        sub="Eingehende Nachrichten aus der WhatsApp-Gruppe werden automatisch zerlegt, dem Tippgeber (VB) zugeordnet und in die passende Sparten-Tabelle gebucht."
        actions={
          <>
            <button
              type="button"
              className="btn"
              onClick={load}
              disabled={loading}
            >
              <KerfaIcon name="refresh" size="sm" />
              <span>Aktualisieren</span>
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={syncOpenWa}
              disabled={syncing}
            >
              <KerfaIcon name="bolt" size="sm" />
              <span>
                {syncing
                  ? "Synchronisiere Gruppe…"
                  : "WhatsApp-Gruppe jetzt synchronisieren"}
              </span>
            </button>
          </>
        }
      />

      {/* Kerfa 3-Step Summary Pipeline (.of-flow > .card.of-step) */}
      <div
        className="of-flow"
        style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}
      >
        <div className="card of-step">
          <span className="of-step__n tone--accent">{msgs.length}</span>
          <div className="cell__text">
            <small>Empfangene Nachrichten</small>
            <b>{TDO_GROUP_CHAT_ID}</b>
          </div>
        </div>

        <div className="card of-step">
          <span className="of-step__n tone--good">{processedCount}</span>
          <div className="cell__text">
            <small>Erfolgreich verbucht</small>
            <b>Automatisch zugeordnet</b>
          </div>
        </div>

        <div className="card of-step">
          <span className="of-step__n tone--warn">{errorCount}</span>
          <div className="cell__text">
            <small>Prüfung / Hinweise</small>
            <b>In `raw_messages` protokolliert</b>
          </div>
        </div>
      </div>

      {/* Two-Column Top Section: Message Simulator + Architecture Info */}
      <div className="ov-top" style={{ marginBottom: "var(--gap)" }}>
        <div className="card">
          <div className="chead">
            <div className="chead__text">
              <h2>WhatsApp-Auftragsnachricht direkt testen / einspeisen</h2>
              <p>
                Simuliert eine Gruppennachricht an `/api/public/whatsapp` inkl.
                automatischer VB-Anlage
              </p>
            </div>
            <Pill tone="accent" dot={false}>
              Sofort-Parser
            </Pill>
          </div>

          <form
            onSubmit={handleSimulateMessage}
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            <label className="field">
              <span>WhatsApp-Absendername (`pushname` / Fallback-VB)</span>
              <input
                className="input"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="z.B. Ghaith Abojamil"
              />
            </label>

            <label className="field">
              <span>Nachrichtentext</span>
              <textarea
                className="textarea"
                rows={7}
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
              />
            </label>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <span className="muted" style={{ fontSize: "var(--fs-xs)" }}>
                Erkennt alle 11 Sparten + neue VBs automatisch
              </span>
              <button
                type="submit"
                className="btn btn--primary"
                disabled={sendingTest}
              >
                <KerfaIcon name="send" size="sm" />
                <span>
                  {sendingTest
                    ? "Wird verarbeitet…"
                    : "Nachricht parsen & buchen"}
                </span>
              </button>
            </div>
          </form>
        </div>

        <div className="ov-side">
          <div className="card">
            <div className="chead">
              <div className="chead__text">
                <h2>OpenWA &amp; Webhook-Details</h2>
                <p>Aktive Konfiguration</p>
              </div>
              <Pill tone="good">Online</Pill>
            </div>
            <div>
              <div className="row-set">
                <div className="row-set__text">
                  <b>Gruppen-ID</b>
                  <small>{TDO_GROUP_CHAT_ID}</small>
                </div>
              </div>
              <div className="row-set">
                <div className="row-set__text">
                  <b>Webhook-Route</b>
                  <small>/api/public/whatsapp</small>
                </div>
              </div>
              <div className="row-set">
                <div className="row-set__text">
                  <b>Neue VB-Logik</b>
                  <small>
                    Erstellt neuen VB-Filter automatisch; nutzt `pushname` als
                    Fallback
                  </small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Message Protocol Table */}
      <div className="card card--flush">
        <div className="chead" style={{ paddingBottom: 14 }}>
          <div className="chead__text">
            <h2>Empfangene Gruppennachrichten ({msgs.length})</h2>
            <p>Echtzeit-Protokoll aus `public.raw_messages`</p>
          </div>
        </div>

        {loading ? (
          <div
            className="muted"
            style={{ padding: 32, textAlign: "center" }}
          >
            Lade Nachrichten…
          </div>
        ) : msgs.length === 0 ? (
          <EmptyState
            icon="chat"
            title="Noch keine Nachrichten empfangen"
            sub="Klicke oben auf WhatsApp-Gruppe jetzt synchronisieren."
          />
        ) : (
          <div className="table-wrap">
            <table className="table table--stack">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Absender</th>
                  <th>Erkannte Sparte / VB</th>
                  <th>Nachrichteninhalt</th>
                  <th className="r">Empfangen am</th>
                </tr>
              </thead>
              <tbody>
                {msgs.map((m) => {
                  const parsedProvider = m.ai_response?.provider;
                  const parsedLine = m.ai_response?.lines?.[0];
                  return (
                    <tr key={m.id}>
                      <td data-label="Status">
                        {m.processed ? (
                          m.parse_error ? (
                            <Pill tone="bad">Fehler</Pill>
                          ) : (
                            <Pill tone="good">Verarbeitet</Pill>
                          )
                        ) : (
                          <Pill tone="warn">Warteschlange</Pill>
                        )}
                      </td>
                      <td data-label="Absender">
                        <div className="cell">
                          <Avatar
                            name={m.from_name || m.from_number || "WA"}
                            tone={1}
                          />
                          <div className="cell__text">
                            <b>{m.from_name ?? m.from_number ?? "Unbekannt"}</b>
                            <small>{m.chat_id || TDO_GROUP_CHAT_ID}</small>
                          </div>
                        </div>
                      </td>
                      <td data-label="Erkannt">
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 6,
                          }}
                        >
                          {parsedProvider && parsedProvider !== "UNKNOWN" && (
                            <Pill tone="accent" dot={false}>
                              {parsedProvider}
                            </Pill>
                          )}
                          {parsedLine?.tippgeber && (
                            <Pill tone="info" dot={false}>
                              VB: {parsedLine.tippgeber}
                            </Pill>
                          )}
                          {m.pdf_filename && (
                            <Pill tone="good" dot={false}>
                              PDF: {m.pdf_filename}
                            </Pill>
                          )}
                        </div>
                      </td>
                      <td data-label="Inhalt">
                        <pre
                          style={{
                            margin: 0,
                            whiteSpace: "pre-wrap",
                            fontSize: "var(--fs-xs)",
                            color: "var(--ink-2)",
                            maxWidth: 520,
                            fontFamily: "var(--font)",
                          }}
                        >
                          {m.body}
                        </pre>
                        {m.parse_error && (
                          <div
                            className="bad"
                            style={{
                              fontSize: "var(--fs-2xs)",
                              marginTop: 4,
                            }}
                          >
                            {m.parse_error}
                          </div>
                        )}
                      </td>
                      <td data-label="Zeitpunkt" className="r muted">
                        {m.received_at
                          ? new Date(m.received_at).toLocaleString("de-DE")
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
