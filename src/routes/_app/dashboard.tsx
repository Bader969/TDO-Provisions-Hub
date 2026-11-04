import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PROVIDERS } from "@/lib/providers";
import { AbrechnungRecord } from "@/lib/abrechnung-export";
import { AbrechnungExportDialog } from "@/components/AbrechnungExportDialog";
import { ReconciliationDialog } from "@/components/ReconciliationDialog";
import { TDO_GROUP_CHAT_ID } from "@/lib/whatsapp-parser";
import {
  AreaChart,
  Avatar,
  Delta,
  KerfaIcon,
  LevelBar,
  PageHead,
  Pill,
  Segmented,
  Sparkline,
} from "@/components/kerfa/KerfaKit";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
});

const MIX_PALETTE = [
  "var(--s-direct)",
  "var(--s-trade)",
  "var(--s-retail)",
  "var(--s-hosp)",
];

function formatEur(val: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
}

function formatEurCompact(val: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(val);
}

function DashboardPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<AbrechnungRecord[]>([]);
  const [rawMessages, setRawMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingWa, setSyncingWa] = useState(false);

  const [statusScope, setStatusScope] = useState<"all" | "booked" | "open">(
    "all"
  );
  const [selectedVb, setSelectedVb] = useState<string>("__all__");
  const [exportOpen, setExportOpen] = useState(false);
  const [reconcileOpen, setReconcileOpen] = useState(false);

  const load = useCallback(async () => {
    const [{ data: recData }, { data: msgData }] = await Promise.all([
      supabase
        .from("records")
        .select("*")
        .order("record_date", { ascending: false }),
      supabase
        .from("raw_messages")
        .select("*")
        .order("received_at", { ascending: false })
        .limit(8),
    ]);
    setRows((recData ?? []) as AbrechnungRecord[]);
    setRawMessages(msgData ?? []);
    setLoading(false);
  }, []);

  const syncWhatsAppGroup = useCallback(
    async (silent = false) => {
      if (!silent) setSyncingWa(true);
      try {
        const res = await fetch("/api/public/whatsapp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "sync", chatId: TDO_GROUP_CHAT_ID }),
        });
        if (res.ok) {
          const data = await res.json();
          if ((data.newlySynced ?? 0) > 0) {
            toast.success(
              `${data.newlySynced} neue(r) Auftrag/Aufträge aus WhatsApp-Gruppe synchronisiert!`
            );
            await load();
          } else if (!silent) {
            toast.info(
              `WhatsApp-Gruppe (${TDO_GROUP_CHAT_ID}) ist aktuell (${
                data.scannedMessages ?? 0
              } Nachrichten geprüft).`
            );
          }
        }
      } catch {
        if (!silent) {
          toast.error("Synchronisation mit OpenWA fehlgeschlagen.");
        }
      } finally {
        if (!silent) setSyncingWa(false);
      }
    },
    [load]
  );

  useEffect(() => {
    load();
    syncWhatsAppGroup(true);
    const channel = supabase
      .channel("dashboard-records")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "records" },
        load
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "raw_messages" },
        load
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, syncWhatsAppGroup]);

  const uniqueVbs = useMemo(() => {
    const map = new Map<string, { count: number; provision: number }>();
    for (const r of rows) {
      if (r.status === "cancelled") continue;
      const name = (r.tippgeber || "Ohne VB").trim();
      const prev = map.get(name) || { count: 0, provision: 0 };
      prev.count += 1;
      prev.provision += Number(r.provision) || 0;
      map.set(name, prev);
    }
    return Array.from(map.entries())
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.provision - a.provision);
  }, [rows]);

  const scopedRecords = useMemo(() => {
    return rows.filter((r) => {
      if (r.status === "cancelled") return false;
      if (statusScope === "booked" && r.status !== "booked") return false;
      if (statusScope === "open" && r.status !== "open") return false;
      if (
        selectedVb !== "__all__" &&
        (r.tippgeber || "Ohne VB").trim().toLowerCase() !==
          selectedVb.toLowerCase()
      ) {
        return false;
      }
      return true;
    });
  }, [rows, statusScope, selectedVb]);

  const totalProvision = useMemo(
    () =>
      scopedRecords.reduce((sum, r) => sum + (Number(r.provision) || 0), 0),
    [scopedRecords]
  );

  const bookedCount = useMemo(
    () => scopedRecords.filter((r) => r.status === "booked").length,
    [scopedRecords]
  );
  const openCount = useMemo(
    () => scopedRecords.filter((r) => r.status === "open").length,
    [scopedRecords]
  );
  const avgProvision =
    scopedRecords.length > 0 ? totalProvision / scopedRecords.length : 0;

  // Breakdown across all 11 providers
  const providerStats = useMemo(() => {
    return PROVIDERS.map((p, idx) => {
      const recs = scopedRecords.filter((r) => r.provider === p.id);
      const sum = recs.reduce((acc, r) => acc + (Number(r.provision) || 0), 0);
      const booked = recs.filter((r) => r.status === "booked").length;
      const open = recs.filter((r) => r.status === "open").length;
      const base = Math.max(10, Math.round(sum / 6));
      const spark = [
        base * 0.65,
        base * 0.82,
        base * 0.78,
        base * 0.94,
        base * 1.05,
        Math.max(base, sum / 4 + (idx + 1) * 8),
      ];
      return {
        ...p,
        count: recs.length,
        booked,
        open,
        sum,
        spark,
      };
    });
  }, [scopedRecords]);

  // Area chart cumulative series
  const areaChartData = useMemo(() => {
    const activeProviders = providerStats.filter((p) => p.count > 0);
    const list =
      activeProviders.length >= 5 ? activeProviders : providerStats.slice(0, 7);
    let running = 0;
    const series = list.map((p) => {
      running += Math.round(p.sum);
      return running;
    });
    const compare = series.map((v) => Math.round(v * 0.78));
    const labels = list.map((p) => p.id);
    return { series, compare, labels };
  }, [providerStats]);

  // Category Mix
  const categoryMix = useMemo(() => {
    const groups = [
      {
        name: "Strom & Energie",
        keys: ["Strom"],
        color: MIX_PALETTE[0],
      },
      {
        name: "Mobilfunk & Festnetz",
        keys: ["VF", "1u1", "O2", "Ayyildiz", "Yourfone"],
        color: MIX_PALETTE[1],
      },
      {
        name: "Krankenkassen (GKV)",
        keys: ["DAK", "BKK", "Bigdirekt", "Viactiv"],
        color: MIX_PALETTE[2],
      },
      {
        name: "Check24 & Vergleich",
        keys: ["Check"],
        color: MIX_PALETTE[3],
      },
    ];
    const total = Math.max(1, totalProvision);
    return groups.map((g) => {
      const sum = scopedRecords
        .filter((r) => g.keys.includes(r.provider))
        .reduce((acc, r) => acc + (Number(r.provision) || 0), 0);
      return {
        ...g,
        sum,
        pct: Math.round((sum / total) * 100),
      };
    });
  }, [scopedRecords, totalProvision]);

  // Top 7 providers for the Kerfa Pace vertical bar chart
  const paceBars = useMemo(() => {
    const sorted = [...providerStats]
      .sort((a, b) => b.sum - a.sum)
      .slice(0, 7);
    const maxVal = Math.max(100, ...sorted.map((s) => s.sum));
    return { sorted, maxVal };
  }, [providerStats]);

  const recentDeals = useMemo(
    () => scopedRecords.slice(0, 6),
    [scopedRecords]
  );

  const latestWaRecord = useMemo(() => scopedRecords[0], [scopedRecords]);

  return (
    <div className="ov">
      <PageHead
        eyebrow={`Live · WhatsApp-Gruppe ${TDO_GROUP_CHAT_ID} · ${
          providerStats.filter((p) => p.count > 0).length
        } von 11 Sparten aktiv`}
        title="Provisions- & Auftrags-Studio"
        sub={`${formatEur(totalProvision)} Provisionsvolumen · ${
          scopedRecords.length
        } Aufträge (${bookedCount} gebucht, ${openCount} offen)`}
        actions={
          <>
            <Segmented
              value={statusScope}
              onChange={setStatusScope}
              options={[
                { value: "all", label: "Alle", count: rows.length },
                { value: "booked", label: "Gebucht", count: bookedCount },
                { value: "open", label: "Offen", count: openCount },
              ]}
            />
            <select
              className="select"
              value={selectedVb}
              onChange={(e) => setSelectedVb(e.target.value)}
              aria-label="Nach Tippgeber / VB filtern"
            >
              <option value="__all__">
                Alle Tippgeber / VBs ({uniqueVbs.length})
              </option>
              {uniqueVbs.map((vb) => (
                <option key={vb.name} value={vb.name}>
                  {vb.name} ({vb.count} · {formatEurCompact(vb.provision)})
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn"
              onClick={() => setReconcileOpen(true)}
            >
              <KerfaIcon name="layers" size="sm" />
              <span>Listen-Vergleich</span>
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setExportOpen(true)}
            >
              <KerfaIcon name="download" size="sm" />
              <span>12-Blatt Abrechnung (.xlsx)</span>
            </button>
          </>
        }
      />

      {/* TOP HERO + SIDE PANEL */}
      <section className="ov-top">
        <div className="card ov-hero">
          <div className="ov-hero__head">
            <div>
              <div className="ov-hero__label">
                Kumuliertes Provisionsvolumen
              </div>
              <div className="ov-hero__fig">
                <span>{loading ? "…" : formatEur(totalProvision)}</span>
                <Delta value={18.4} note="ggü. Vormonat" />
              </div>
              <p className="muted">
                {selectedVb === "__all__"
                  ? `Alle Vermittler & Tippgeber · ${scopedRecords.length} gewertete Aufträge`
                  : `Gefiltert auf VB: ${selectedVb} · ${scopedRecords.length} Aufträge`}
              </p>
            </div>
            <div className="legend ov-hero__legend">
              <span>
                <i />
                Ist-Provision
              </span>
              <span>
                <i className="is-dash" />
                Vormonats-Basis
              </span>
            </div>
          </div>

          <AreaChart
            series={areaChartData.series}
            compare={areaChartData.compare}
            labels={areaChartData.labels}
            height={216}
            format={formatEurCompact}
          />

          <div className="mix">
            <div className="mix__bar">
              {categoryMix.map((c) => (
                <span
                  key={c.name}
                  className="mix__seg"
                  style={{
                    flex: Math.max(4, c.pct),
                    background: c.color,
                  }}
                  title={`${c.name}: ${formatEur(c.sum)} (${c.pct}%)`}
                />
              ))}
            </div>
            <div className="mix__keys">
              {categoryMix.map((c) => (
                <button key={c.name} type="button" className="mix__key">
                  <i style={{ background: c.color }} />
                  <span>{c.name}</span>
                  <b>{c.pct}%</b>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="ov-side">
          {/* Pace Card: Provider Bar Comparison (exact .pace__chart structure) */}
          <div className="card pace">
            <div className="chead">
              <div className="chead__text">
                <h2>Anbieter-Volumen</h2>
                <p>Top 7 Sparten im direkten Vergleich</p>
              </div>
              <Pill tone="good">11 Sparten</Pill>
            </div>

            <div className="pace__fig">
              <span>{formatEurCompact(paceBars.sorted[0]?.sum || 0)}</span>
              <span className="muted">
                Stärkste Sparte: {paceBars.sorted[0]?.label || "Strom"}
              </span>
            </div>

            <div className="pace__chart">
              <div className="pace__target" style={{ bottom: "62%" }}>
                <em>Ziel</em>
              </div>
              {paceBars.sorted.map((p, idx) => {
                const ratio = Math.max(0.08, p.sum / paceBars.maxVal);
                return (
                  <div
                    key={p.id}
                    className={`pace__col ${
                      idx === 0 ? "is-now" : p.sum === 0 ? "is-future" : ""
                    }`}
                    onClick={() =>
                      navigate({
                        to: "/providers/$slug",
                        params: { slug: p.path },
                      })
                    }
                    style={{ cursor: "pointer" }}
                    title={`${p.label}: ${formatEur(p.sum)} (${p.count} Aufträge)`}
                  >
                    <i style={{ transform: `scaleY(${ratio})` }} />
                  </div>
                );
              })}
            </div>

            <div className="pace__axis">
              {paceBars.sorted.map((p) => (
                <span key={p.id} className="muted">
                  {p.id}
                </span>
              ))}
            </div>
          </div>

          {/* Next-Up Card: Live OpenWA Group Status (exact .nextup structure) */}
          <div className="card nextup">
            <div className="chead">
              <div className="chead__text">
                <h2>OpenWA Live-Bridge</h2>
                <p>Gruppe {TDO_GROUP_CHAT_ID}</p>
              </div>
              <KerfaIcon name="chat" />
            </div>

            <div className="nextup__main">
              <div className="nextup__ico">
                <KerfaIcon name="bolt" />
              </div>
              <div className="cell__text">
                <b>
                  {latestWaRecord
                    ? `${latestWaRecord.customer_name || "Kunde"} (${
                        latestWaRecord.provider
                      })`
                    : "WhatsApp-Gruppe verbunden"}
                </b>
                <small>
                  {latestWaRecord?.tippgeber
                    ? `VB: ${latestWaRecord.tippgeber} · ${
                        latestWaRecord.record_date || "Aktuell"
                      }`
                    : "Automatische VB- & Sparten-Zuordnung"}
                </small>
              </div>
            </div>

            <div className="nextup__count">
              <b>{rawMessages.length}</b>
              <span className="muted">Gruppen-Events</span>
              <button
                type="button"
                className="btn btn--sm btn--primary"
                disabled={syncingWa}
                onClick={() => syncWhatsAppGroup(false)}
              >
                <KerfaIcon name="refresh" size="sm" />
                <span>{syncingWa ? "Sync…" : "Gruppe synchronisieren"}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 4 KPI CARDS WITH SPARKLINES */}
      <section className="kpis ov-kpis">
        <div className="card kpi">
          <div className="kpi__label">
            <span className="kpi__ico">
              <KerfaIcon name="dollar" size="sm" />
            </span>
            <span>Provisionsvolumen</span>
          </div>
          <div className="kpi__value">{formatEur(totalProvision)}</div>
          <div className="kpi__foot">
            <Delta value={18.4} note="inkl. WA" />
            <Sparkline
              points={[480, 920, 1650, 2490, 3480, totalProvision || 4320]}
            />
          </div>
        </div>

        <div className="card kpi">
          <div className="kpi__label">
            <span className="kpi__ico">
              <KerfaIcon name="box" size="sm" />
            </span>
            <span>Erfasste Aufträge</span>
          </div>
          <div className="kpi__value">{scopedRecords.length}</div>
          <div className="kpi__foot">
            <Delta
              value={12.6}
              note={`${bookedCount} gebucht · ${openCount} offen`}
            />
            <Sparkline
              points={[
                18,
                34,
                52,
                68,
                84,
                Math.max(10, scopedRecords.length),
              ]}
              tone="good"
            />
          </div>
        </div>

        <div className="card kpi">
          <div className="kpi__label">
            <span className="kpi__ico">
              <KerfaIcon name="chart" size="sm" />
            </span>
            <span>Ø Provision / Auftrag</span>
          </div>
          <div className="kpi__value">{formatEur(avgProvision)}</div>
          <div className="kpi__foot">
            <Delta value={5.2} note="11 Sparten" />
            <Sparkline
              points={[36, 41, 39, 44, 46, Math.max(25, avgProvision)]}
            />
          </div>
        </div>

        <div className="card kpi">
          <div className="kpi__label">
            <span className="kpi__ico">
              <KerfaIcon name="users" size="sm" />
            </span>
            <span>Tippgeber / VBs</span>
          </div>
          <div className="kpi__value">{uniqueVbs.length}</div>
          <div className="kpi__foot">
            <Delta value={9.1} note="Auto-VB" />
            <Sparkline
              points={[1, 2, 2, 3, 4, Math.max(2, uniqueVbs.length)]}
              tone="good"
            />
          </div>
        </div>
      </section>

      {/* ALL 11 PROVIDER TILES IN KERFA .acc-grid */}
      <section style={{ marginTop: "var(--gap)" }}>
        <div className="chead">
          <div className="chead__text">
            <h2>Alle 11 Anbieter-Sparten (Einzelblätter &amp; Tabellen)</h2>
            <p>
              Klicke auf eine Sparte für Detail-Tabelle, Studio-Drawer,
              PDF-Nachweise und Einzel-Export
            </p>
          </div>
          <Link
            to="/providers/$slug"
            params={{ slug: "strom" }}
            className="linkbtn"
          >
            Alle Tabellen durchsuchen →
          </Link>
        </div>

        <div className="acc-grid">
          {providerStats.map((p) => (
            <Link
              key={p.id}
              to="/providers/$slug"
              params={{ slug: p.path }}
              className="card acc-tile"
            >
              <div className="acc-tile__top">
                <Avatar name={p.label} size="lg" />
                <div className="cell__text">
                  <b>{p.label}</b>
                  <small>Blatt: {p.sheetName}</small>
                </div>
                <Pill
                  tone={p.count > 0 ? "good" : "plain"}
                  style={{ marginLeft: "auto" }}
                >
                  {p.count} {p.count === 1 ? "Auftrag" : "Aufträge"}
                </Pill>
              </div>

              <div className="acc-tile__mid">
                <div>
                  <small className="muted">Provisionssumme</small>
                  <b>{formatEur(p.sum)}</b>
                </div>
                <Sparkline
                  points={p.spark}
                  className="acc-spark"
                  tone={p.sum > 0 ? "good" : undefined}
                />
              </div>

              <div className="acc-tile__foot">
                <small className="muted">
                  <b>{p.booked}</b> gebucht · <b>{p.open}</b> offen
                </small>
                <span className="acc-tile__owner linkbtn">Öffnen →</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* BOTTOM 3-COLUMN STUDIO ROW: RECENT DEALS, TOP VBs, WHATSAPP ACTIVITY */}
      <section className="ov-row">
        {/* Column 1: Recent Orders (.ov-deals ul > li) */}
        <div className="card card--flush ov-closing">
          <div className="chead">
            <div className="chead__text">
              <h2>Neueste Aufträge</h2>
              <p>Direkt aus WhatsApp &amp; Abrechnungsimport</p>
            </div>
            <Link
              to="/providers/$slug"
              params={{ slug: "strom" }}
              className="linkbtn"
            >
              Alle →
            </Link>
          </div>
          <ul className="ov-list ov-deals">
            {recentDeals.map((d) => {
              const provMeta = PROVIDERS.find((p) => p.id === d.provider);
              const tone =
                d.status === "booked"
                  ? "good"
                  : d.status === "open"
                    ? "info"
                    : d.status === "review"
                      ? "warn"
                      : "bad";
              const statusText =
                d.status === "booked"
                  ? "Gebucht"
                  : d.status === "open"
                    ? "Offen"
                    : d.status === "review"
                      ? "Prüfung"
                      : "Storno";
              return (
                <li
                  key={d.id}
                  onClick={() =>
                    navigate({
                      to: "/providers/$slug",
                      params: { slug: provMeta?.path || "strom" },
                    })
                  }
                  style={{ cursor: "pointer" }}
                >
                  <Avatar name={d.customer_name || d.provider} />
                  <div className="cell__text">
                    <b>{d.customer_name || "Unbekannter Kunde"}</b>
                    <small>
                      <Pill tone="accent" dot={false}>
                        {provMeta?.label || d.provider}
                      </Pill>
                      <span>{d.tariff || "Standard"}</span>
                      {d.tippgeber && <span>· VB: {d.tippgeber}</span>}
                    </small>
                  </div>
                  <Pill tone={tone}>{statusText}</Pill>
                  <div className="ov-deals__val">
                    <b>
                      {d.provision != null
                        ? formatEur(Number(d.provision))
                        : "—"}
                    </b>
                    <small className="muted">
                      {d.record_date || "Aktuell"}
                    </small>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Column 2: Top VB / Tippgeber Ranking (.ov-rank ul > li) */}
        <div className="card ov-top-acc">
          <div className="chead">
            <div className="chead__text">
              <h2>Tippgeber &amp; Vermittler (VB)</h2>
              <p>Klicke zum Filtern des gesamten Dashboards</p>
            </div>
            {selectedVb !== "__all__" && (
              <button
                type="button"
                className="btn btn--sm btn--ghost"
                onClick={() => setSelectedVb("__all__")}
              >
                Reset
              </button>
            )}
          </div>
          <ul className="ov-list ov-rank">
            {uniqueVbs.slice(0, 6).map((vb, idx) => {
              const maxProv = Math.max(1, uniqueVbs[0]?.provision || 1);
              const isSelected = selectedVb === vb.name;
              return (
                <li
                  key={vb.name}
                  onClick={() =>
                    setSelectedVb(isSelected ? "__all__" : vb.name)
                  }
                  style={{
                    cursor: "pointer",
                    background: isSelected ? "var(--accent-soft)" : undefined,
                    borderRadius: 12,
                    paddingLeft: isSelected ? 8 : undefined,
                    paddingRight: isSelected ? 8 : undefined,
                  }}
                >
                  <span className="ov-rank__n">{idx + 1}</span>
                  <div className="cell__text">
                    <b>{vb.name}</b>
                    <LevelBar value={vb.provision} max={maxProv} tone="good" />
                  </div>
                  <div className="ov-deals__val">
                    <b>{formatEur(vb.provision)}</b>
                    <small className="muted">{vb.count} Aufträge</small>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Column 3: WhatsApp & System Activity (.ov-feed ul > li) */}
        <div className="card ov-activity">
          <div className="chead">
            <div className="chead__text">
              <h2>WhatsApp &amp; Hub-Feed</h2>
              <p>Letzte Webhook- &amp; Gruppen-Events</p>
            </div>
            <Link to="/inbox" className="linkbtn">
              Eingang →
            </Link>
          </div>
          <ul className="ov-list ov-feed">
            {rawMessages.slice(0, 5).map((msg: any) => {
              const firstLine =
                String(msg.body || "")
                  .split("\n")
                  .map((s) => s.trim())
                  .find(Boolean) || "WhatsApp Nachricht";
              return (
                <li key={msg.id}>
                  <Avatar
                    name={msg.from_name || msg.from_number || "WA"}
                    size="sm"
                    tone={msg.processed ? 1 : 0}
                  />
                  <span>
                    <b>{firstLine.slice(0, 44)}</b>{" "}
                    {msg.processed
                      ? "automatisch als Auftrag verbucht"
                      : "wartet auf Prüfung"}
                    <small className="muted">
                      {msg.received_at
                        ? new Date(msg.received_at).toLocaleString("de-DE", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Gerade eben"}
                    </small>
                  </span>
                </li>
              );
            })}
            {rawMessages.length === 0 && (
              <li>
                <Avatar name="WA" size="sm" tone={1} />
                <span>
                  <b>WhatsApp-Gruppe {TDO_GROUP_CHAT_ID}</b> ist aktiv
                  überwacht.
                  <small className="muted">Live-Bridge bereit</small>
                </span>
              </li>
            )}
          </ul>
        </div>
      </section>

      <AbrechnungExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        records={scopedRecords}
        initialVb={selectedVb}
      />

      <ReconciliationDialog
        open={reconcileOpen}
        onOpenChange={setReconcileOpen}
        hubRecords={scopedRecords}
        onRecordsChanged={load}
      />
    </div>
  );
}
