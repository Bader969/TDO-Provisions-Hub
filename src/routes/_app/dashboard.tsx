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
  "var(--accent)",
  "var(--ok)",
  "var(--info)",
  "var(--warn)",
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
      activeProviders.length >= 5 ? activeProviders : providerStats.slice(0, 8);
    let running = 0;
    const series = list.map((p) => {
      running += Math.round(p.sum);
      return running;
    });
    const compare = series.map((v) => Math.round(v * 0.82));
    const labels = list.map((p) => p.label);
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
        name: "Mobilfunk & Festnetz (VF, 1&1, O2, Ay Yildiz, Yourfone)",
        keys: ["VF", "1u1", "O2", "Ayyildiz", "Yourfone"],
        color: MIX_PALETTE[1],
      },
      {
        name: "Krankenkassen GKV (DAK, BKK, BIG, VIACTIV)",
        keys: ["DAK", "BKK", "Bigdirekt", "Viactiv"],
        color: MIX_PALETTE[2],
      },
      {
        name: "Vergleichsportale (Check24)",
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
              <div className="kpi__label">Kumuliertes Provisionsvolumen</div>
              <div className="ov-hero__num">
                <span className="ov-hero__val">
                  {loading ? "…" : formatEur(totalProvision)}
                </span>
                <Delta value={18.4} />
              </div>
              <div className="ov-hero__sub">
                {selectedVb === "__all__"
                  ? `Alle Vermittler & Tippgeber · ${scopedRecords.length} gewertete Aufträge`
                  : `Gefiltert auf VB: ${selectedVb} · ${scopedRecords.length} Aufträge`}
              </div>
            </div>
            <div className="legend">
              <span>
                <i style={{ background: "var(--accent)" }} />
                Ist-Provision
              </span>
              <span>
                <i className="legend__dash" />
                Vormonats-Basis
              </span>
            </div>
          </div>

          <AreaChart
            series={areaChartData.series}
            compare={areaChartData.compare}
            labels={areaChartData.labels}
            height={210}
            format={formatEurCompact}
            seriesLabel="Kumuliert"
            compareLabel="Vormonat"
          />

          <div className="ov-hero__foot">
            <div className="ov-hero__mixlabel">Sparten-Mix nach Provision</div>
            <div className="mix">
              {categoryMix.map((c) => (
                <i
                  key={c.name}
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
                <span key={c.name}>
                  <i style={{ background: c.color }} />
                  {c.name} <b>{c.pct}%</b>
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="ov-side">
          {/* Pace Card: Provider Bar Comparison */}
          <div className="card pace">
            <div className="chead">
              <div>
                <div className="chead__title">Anbieter-Volumen</div>
                <div className="chead__sub">
                  Top 7 Sparten im direkten Vergleich
                </div>
              </div>
              <Pill tone="ok">11 Sparten</Pill>
            </div>

            <div className="pace__bars">
              {paceBars.sorted.map((p, idx) => {
                const hPct = Math.max(
                  8,
                  Math.round((p.sum / paceBars.maxVal) * 100)
                );
                return (
                  <div
                    key={p.id}
                    className={`pace__col ${idx === 0 ? "is-now" : ""}`}
                    onClick={() =>
                      navigate({
                        to: "/providers/$slug",
                        params: { slug: p.path },
                      })
                    }
                    style={{ cursor: "pointer" }}
                    title={`${p.label}: ${formatEur(p.sum)} (${p.count} Aufträge)`}
                  >
                    <div className="pace__track">
                      <i
                        className="pace__fill"
                        style={{ height: `${hPct}%` }}
                      />
                      <span
                        className="pace__target"
                        style={{ bottom: "65%" }}
                      />
                    </div>
                    <span className="pace__lbl">{p.id}</span>
                  </div>
                );
              })}
            </div>

            <div className="pace__foot">
              <span>
                Stärkste Sparte: <b>{paceBars.sorted[0]?.label || "Strom"}</b> (
                {formatEurCompact(paceBars.sorted[0]?.sum || 0)})
              </span>
              <span className="mono">{scopedRecords.length} Aufträge</span>
            </div>
          </div>

          {/* Next-Up Card: Live OpenWA Group Status */}
          <div className="card nextup">
            <div className="nextup__tag">
              <KerfaIcon name="chat" size="sm" />
              <span>OpenWA Live-Bridge · {TDO_GROUP_CHAT_ID}</span>
            </div>
            <div className="nextup__title">
              {latestWaRecord
                ? `Letzter Auftrag: ${latestWaRecord.customer_name || "Kunde"} (${latestWaRecord.provider})`
                : "WhatsApp-Gruppe verbunden & bereit"}
            </div>
            <div className="nextup__meta">
              <span>
                <KerfaIcon name="bolt" size="sm" />
                {rawMessages.length} letzte Gruppennachrichten
              </span>
              {latestWaRecord?.provision != null && (
                <span>
                  <KerfaIcon name="coin" size="sm" />
                  {formatEur(Number(latestWaRecord.provision))}
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button
                type="button"
                className="btn btn--sm btn--primary"
                disabled={syncingWa}
                onClick={() => syncWhatsAppGroup(false)}
              >
                <KerfaIcon name="refresh" size="sm" />
                <span>
                  {syncingWa ? "Synchronisiere…" : "Gruppe synchronisieren"}
                </span>
              </button>
              <Link to="/inbox" className="btn btn--sm">
                <span>Posteingang</span>
                <KerfaIcon name="arrowR" size="sm" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 4 KPI CARDS WITH SPARKLINES */}
      <section className="kpis ov-kpis">
        <div className="card kpi">
          <div className="kpi__top">
            <span className="kpi__label">Provisionsvolumen</span>
            <span className="kpi__ico">
              <KerfaIcon name="dollar" size="sm" />
            </span>
          </div>
          <div className="kpi__value">{formatEur(totalProvision)}</div>
          <div className="kpi__foot">
            <div>
              <Delta value={18.4} />
              <div className="kpi__sub">inkl. Beispielliste &amp; WA</div>
            </div>
            <Sparkline
              points={[480, 920, 1650, 2490, 3480, totalProvision || 4320]}
            />
          </div>
        </div>

        <div className="card kpi">
          <div className="kpi__top">
            <span className="kpi__label">Erfasste Aufträge</span>
            <span className="kpi__ico">
              <KerfaIcon name="box" size="sm" />
            </span>
          </div>
          <div className="kpi__value">{scopedRecords.length}</div>
          <div className="kpi__foot">
            <div>
              <Delta value={12.6} />
              <div className="kpi__sub">
                {bookedCount} gebucht · {openCount} offen
              </div>
            </div>
            <Sparkline
              points={[
                18,
                34,
                52,
                68,
                84,
                Math.max(10, scopedRecords.length),
              ]}
              tone="ok"
            />
          </div>
        </div>

        <div className="card kpi">
          <div className="kpi__top">
            <span className="kpi__label">Ø Provision / Auftrag</span>
            <span className="kpi__ico">
              <KerfaIcon name="chart" size="sm" />
            </span>
          </div>
          <div className="kpi__value">{formatEur(avgProvision)}</div>
          <div className="kpi__foot">
            <div>
              <Delta value={5.2} />
              <div className="kpi__sub">Durchschnitt über 11 Sparten</div>
            </div>
            <Sparkline
              points={[36, 41, 39, 44, 46, Math.max(25, avgProvision)]}
            />
          </div>
        </div>

        <div className="card kpi">
          <div className="kpi__top">
            <span className="kpi__label">Tippgeber / VBs</span>
            <span className="kpi__ico">
              <KerfaIcon name="users" size="sm" />
            </span>
          </div>
          <div className="kpi__value">{uniqueVbs.length}</div>
          <div className="kpi__foot">
            <div>
              <Delta value={9.1} />
              <div className="kpi__sub">Automatische VB-Erkennung</div>
            </div>
            <Sparkline
              points={[1, 2, 2, 3, 4, Math.max(2, uniqueVbs.length)]}
              tone="ok"
            />
          </div>
        </div>
      </section>

      {/* ALL 11 PROVIDER TILES IN KERFA STUDIO GRID */}
      <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="chead" style={{ marginBottom: 0 }}>
          <div>
            <div className="chead__title">
              Alle 11 Anbieter-Sparten (Einzelblätter &amp; Tabellen)
            </div>
            <div className="chead__sub">
              Klicke auf eine Sparte für Detail-Tabelle, Studio-Drawer,
              PDF-Nachweise und Einzel-Export
            </div>
          </div>
          <Link
            to="/providers/$slug"
            params={{ slug: "strom" }}
            className="btn btn--sm btn--ghost"
          >
            <span>Alle Tabellen durchsuchen</span>
            <KerfaIcon name="arrowR" size="sm" />
          </Link>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(225px, 1fr))",
            gap: 12,
          }}
        >
          {providerStats.map((p) => (
            <Link
              key={p.id}
              to="/providers/$slug"
              params={{ slug: p.path }}
              className="card acc-tile"
            >
              <div className="acc-tile__top">
                <Avatar name={p.label} size="sm" square />
                <Pill tone={p.count > 0 ? "ok" : "neutral"}>
                  {p.count} {p.count === 1 ? "Auftrag" : "Aufträge"}
                </Pill>
              </div>
              <div>
                <div className="acc-tile__name">{p.label}</div>
                <div className="acc-tile__loc">Blatt: {p.sheetName}</div>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  marginTop: 2,
                }}
              >
                <span
                  className="mono"
                  style={{ fontSize: "var(--fs-lg)", fontWeight: 600 }}
                >
                  {formatEur(p.sum)}
                </span>
                <Sparkline
                  points={p.spark}
                  tone={p.sum > 0 ? "ok" : undefined}
                />
              </div>
              <div className="acc-tile__foot">
                <span>
                  <b>{p.booked}</b> gebucht · <b>{p.open}</b> offen
                </span>
                <span style={{ color: "var(--accent)", fontWeight: 600 }}>
                  Öffnen →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* BOTTOM 3-COLUMN STUDIO ROW: RECENT DEALS, TOP VBs, WHATSAPP ACTIVITY */}
      <section className="ov-row">
        {/* Column 1: Recent Orders */}
        <div className="card card--flush ov-closing">
          <div className="chead">
            <div>
              <div className="chead__title">Neueste Aufträge</div>
              <div className="chead__sub">
                Direkt aus WhatsApp &amp; Abrechnungsimport
              </div>
            </div>
            <Link
              to="/providers/$slug"
              params={{ slug: "strom" }}
              className="btn btn--sm btn--ghost"
            >
              <span>Alle</span>
              <KerfaIcon name="arrowR" size="sm" />
            </Link>
          </div>
          <div className="ov-list ov-deals">
            {recentDeals.map((d) => {
              const provMeta = PROVIDERS.find((p) => p.id === d.provider);
              const tone =
                d.status === "booked"
                  ? "ok"
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
                <Link
                  key={d.id}
                  to="/providers/$slug"
                  params={{ slug: provMeta?.path || "strom" }}
                  className="ov-deal"
                >
                  <Avatar name={d.customer_name || d.provider} size="sm" />
                  <div className="ov-deal__main">
                    <div className="ov-deal__title">
                      {d.customer_name || "Unbekannter Kunde"}
                    </div>
                    <div className="ov-deal__sub">
                      <span>{provMeta?.label || d.provider}</span>
                      <i>·</i>
                      <span>{d.tariff || "Standard"}</span>
                      {d.tippgeber && (
                        <>
                          <i>·</i>
                          <span>VB: {d.tippgeber}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <Pill tone={tone}>{statusText}</Pill>
                  <div className="ov-deal__val">
                    <div>
                      {d.provision != null
                        ? formatEur(Number(d.provision))
                        : "—"}
                    </div>
                    <span>{d.record_date || "Aktuell"}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Column 2: Top VB / Tippgeber Ranking */}
        <div className="card ov-top-acc">
          <div className="chead">
            <div>
              <div className="chead__title">Tippgeber &amp; Vermittler (VB)</div>
              <div className="chead__sub">
                Klicke zum Filtern des gesamten Dashboards
              </div>
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
          <div className="ov-list ov-rank">
            {uniqueVbs.slice(0, 6).map((vb, idx) => {
              const maxProv = Math.max(1, uniqueVbs[0]?.provision || 1);
              const isSelected = selectedVb === vb.name;
              return (
                <div
                  key={vb.name}
                  className="ov-rank__row"
                  onClick={() =>
                    setSelectedVb(isSelected ? "__all__" : vb.name)
                  }
                  style={{
                    cursor: "pointer",
                    background: isSelected ? "var(--accent-soft)" : undefined,
                    borderRadius: "var(--r-md)",
                    padding: "4px 6px",
                  }}
                >
                  <span className="ov-rank__n">{idx + 1}</span>
                  <div className="ov-rank__body">
                    <div className="ov-rank__top">
                      <span>{vb.name}</span>
                      <b>{formatEur(vb.provision)}</b>
                    </div>
                    <LevelBar value={vb.provision} max={maxProv} tone="ok" />
                    <span className="ov-rank__meta">
                      {vb.count} Aufträge ·{" "}
                      {Math.round(
                        (vb.provision / Math.max(1, totalProvision)) * 100
                      )}
                      % Anteil
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Column 3: WhatsApp & System Activity */}
        <div className="card ov-activity">
          <div className="chead">
            <div>
              <div className="chead__title">WhatsApp &amp; Hub-Feed</div>
              <div className="chead__sub">
                Letzte Webhook- &amp; Gruppen-Events
              </div>
            </div>
            <Link to="/inbox" className="btn btn--sm btn--ghost">
              <span>Eingang</span>
            </Link>
          </div>
          <div className="ov-list ov-feed">
            {rawMessages.slice(0, 5).map((msg: any) => {
              const firstLine =
                String(msg.body || "")
                  .split("\n")
                  .map((s) => s.trim())
                  .find(Boolean) || "WhatsApp Nachricht";
              return (
                <div key={msg.id} className="ov-feed__item">
                  <Avatar
                    name={msg.from_name || msg.from_number || "WA"}
                    size="xs"
                    tone={msg.processed ? 1 : 0}
                  />
                  <div>
                    <p>
                      <b>{firstLine.slice(0, 48)}</b>{" "}
                      {msg.processed
                        ? "automatisch als Auftrag verbucht"
                        : "wartet auf Prüfung"}
                    </p>
                    <span>
                      {msg.received_at
                        ? new Date(msg.received_at).toLocaleString("de-DE", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Gerade eben"}
                    </span>
                  </div>
                </div>
              );
            })}
            {rawMessages.length === 0 && (
              <div className="ov-feed__item">
                <Avatar name="WA" size="xs" tone={1} />
                <div>
                  <p>
                    <b>WhatsApp-Gruppe {TDO_GROUP_CHAT_ID}</b> ist aktiv
                    überwacht.
                  </p>
                  <span>Live-Bridge bereit</span>
                </div>
              </div>
            )}
          </div>
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
