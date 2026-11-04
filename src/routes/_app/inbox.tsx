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
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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

      {/* Kerfa 3-Step Summary Pipeline */}
      <div
        className="of-flow"
        style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}
      >
        <div className="card of-step">
          <div className="of-step__top">
            <span className="of-step__label">Empfangene Nachrichten</span>
            <span className="of-step__n of-step__n--accent">{msgs.length}</span>
          </div>
          <div className="of-step__val">{TDO_GROUP_CHAT_ID}</div>
        </div>

        <div className="card of-step">
          <div className="of-step__top">
            <span className="of-step__label">Erfolgreich verbucht</span>
            <span className="of-step__n of-step__n--ok">{processedCount}</span>
          </div>
          <div className="of-step__val">Automatische Sparten-Zuordnung</div>
        </div>

        <div className="card of-step">
          <div className="of-step__top">
            <span className="of-step__label">Prüfung / Hinweise</span>
            <span className="of-step__n of-step__n--warn">{errorCount}</span>
          </div>
          <div className="of-step__val">Protokolliert in `raw_messages`</div>
        </div>
      </div>

      {/* Two-Column Top Section: Message Simulator + Architecture Info */}
      <div className="ov-top">
        <div className="card">
          <div className="chead">
            <div>
              <div className="chead__title">
                WhatsApp-Auftragsnachricht direkt testen / einspeisen
              </div>
              <div className="chead__sub">
                Simuliert eine Gruppennachricht an `/api/public/whatsapp` inkl.
                automatischer VB-Anlage
              </div>
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
              <span className="field__label">
                WhatsApp-Absendername (`pushname` / Fallback-VB)
              </span>
              <input
                className="input"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="z.B. Ghaith Abojamil"
              />
            </label>

            <label className="field">
              <span className="field__label">Nachrichtentext</span>
              <textarea
                className="textarea mono"
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
              <span style={{ fontSize: "var(--fs-xs)", color: "var(--ink-3)" }}>
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
              <div>
                <div className="chead__title">OpenWA &amp; Webhook-Details</div>
                <div className="chead__sub">Aktive Konfiguration</div>
              </div>
              <Pill tone="ok">Online</Pill>
            </div>
            <div className="kv">
              <div>
                <dt>Gruppen-ID</dt>
                <dd className="mono">{TDO_GROUP_CHAT_ID}</dd>
              </div>
              <div>
                <dt>Webhook</dt>
                <dd className="mono">/api/public/whatsapp</dd>
              </div>
              <div>
                <dt>Neue VB-Logik</dt>
                <dd>Erstellt neuen VB-Filter automatisch</dd>
              </div>
              <div>
                <dt>Ohne VB im Text</dt>
                <dd>Nutzt WhatsApp-Absender (`pushname`)</dd>
              </div>
            </div>
          </div>

          <div className="card nextup">
            <div className="nextup__tag">
              <KerfaIcon name="sparkles" size="sm" />
              <span>Keine Nachricht geht verloren</span>
            </div>
            <div className="nextup__title">
              Automatische Tippgeber-Erkennung (VB)
            </div>
            <div
              style={{
                fontSize: "var(--fs-xs)",
                color: "var(--ink-2)",
                lineHeight: 1.45,
              }}
            >
              Existiert ein Tippgeber (VB) noch nicht im Hub, wird er beim
              Speichern automatisch angelegt und erscheint sofort in allen
              Auswahlfiltern und im 12-Blatt Abrechnungsexport.
            </div>
          </div>
        </div>
      </div>

      {/* Message Protocol Table */}
      <div className="card card--flush">
        <div className="chead">
          <div>
            <div className="chead__title">
              Empfangene Gruppennachrichten ({msgs.length})
            </div>
            <div className="chead__sub">
              Echtzeit-Protokoll aus `public.raw_messages`
            </div>
          </div>
        </div>

        {loading ? (
          <div
            style={{ padding: 32, textAlign: "center", color: "var(--ink-3)" }}
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
            <table className="table table--cards">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Absender</th>
                  <th>Erkannte Sparte / VB</th>
                  <th>Nachrichteninhalt</th>
                  <th>Empfangen am</th>
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
                            <Pill tone="ok">Verarbeitet</Pill>
                          )
                        ) : (
                          <Pill tone="warn">Warteschlange</Pill>
                        )}
                      </td>
                      <td data-label="Absender">
                        <div className="row-title">
                          <Avatar
                            name={m.from_name || m.from_number || "WA"}
                            size="sm"
                            tone={1}
                          />
                          <div className="row-title__text">
                            <span className="row-title__main">
                              {m.from_name ?? m.from_number ?? "Unbekannt"}
                            </span>
                            <span className="row-title__sub mono">
                              {m.chat_id || TDO_GROUP_CHAT_ID}
                            </span>
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
                            <Pill tone="ok" dot={false}>
                              PDF: {m.pdf_filename}
                            </Pill>
                          )}
                        </div>
                      </td>
                      <td data-label="Inhalt">
                        <pre
                          className="mono"
                          style={{
                            margin: 0,
                            whiteSpace: "pre-wrap",
                            fontSize: "var(--fs-xs)",
                            color: "var(--ink-2)",
                            maxWidth: 520,
                          }}
                        >
                          {m.body}
                        </pre>
                        {m.parse_error && (
                          <div
                            style={{
                              color: "var(--bad)",
                              fontSize: "var(--fs-2xs)",
                              marginTop: 4,
                            }}
                          >
                            {m.parse_error}
                          </div>
                        )}
                      </td>
                      <td data-label="Zeitpunkt">
                        <span
                          className="mono"
                          style={{
                            fontSize: "var(--fs-xs)",
                            color: "var(--ink-3)",
                          }}
                        >
                          {m.received_at
                            ? new Date(m.received_at).toLocaleString("de-DE")
                            : "—"}
                        </span>
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
