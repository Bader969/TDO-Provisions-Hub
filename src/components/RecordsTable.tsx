import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  PROVIDER_EXTRA_COLUMNS,
  ProviderId,
  providerById,
} from "@/lib/providers";
import { useAuth } from "@/lib/auth-context";
import { ReconciliationDialog } from "./ReconciliationDialog";
import { exportMultiSheetAbrechnung } from "@/lib/abrechnung-export";
import {
  Avatar,
  EmptyState,
  KerfaDrawer,
  KerfaIcon,
  KerfaModal,
  type KerfaTone,
  PageHead,
  Pill,
  SearchInput,
} from "@/components/kerfa/KerfaKit";

const STATUS_TONE: Record<string, KerfaTone> = {
  booked: "ok",
  open: "info",
  review: "warn",
  cancelled: "bad",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Offen",
  booked: "Gebucht",
  cancelled: "Storniert",
  review: "Prüfung",
};

function formatEur(n: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function RecordsTable({
  provider,
  headerNav,
}: {
  provider: ProviderId;
  headerNav?: React.ReactNode;
}) {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [vbFilter, setVbFilter] = useState("__all__");

  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [drawerRow, setDrawerRow] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  const [formState, setFormState] = useState({
    customer_name: "",
    tariff: "",
    tippgeber: "Ghaith Abojamil",
    provision: "",
    status: "booked",
    record_date: new Date().toISOString().slice(0, 10),
    data: {} as Record<string, any>,
  });

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [pdfTargetRow, setPdfTargetRow] = useState<any | null>(null);

  const meta = providerById(provider);
  const extraCols = PROVIDER_EXTRA_COLUMNS[provider] ?? [];

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("records")
      .select("*")
      .eq("provider", provider)
      .order("record_date", { ascending: false });
    if (error) toast.error(error.message);
    else setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel(`records-${provider}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "records",
          filter: `provider=eq.${provider}`,
        },
        () => {
          fetchData();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  const vbList = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => {
      if (r.tippgeber?.trim()) s.add(r.tippgeber.trim());
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b, "de"));
  }, [rows]);

  const flowSteps = useMemo(() => {
    const compute = (st: string) => {
      const list =
        st === "all"
          ? rows.filter((r) => r.status !== "cancelled")
          : rows.filter((r) => r.status === st);
      const sum = list.reduce((acc, r) => acc + Number(r.provision ?? 0), 0);
      return { count: list.length, sum };
    };
    return [
      {
        id: "all",
        label: "Aktive Aufträge",
        tone: "accent" as const,
        ...compute("all"),
      },
      {
        id: "booked",
        label: "Gebucht",
        tone: "ok" as const,
        ...compute("booked"),
      },
      {
        id: "open",
        label: "Offen",
        tone: "info" as const,
        ...compute("open"),
      },
      {
        id: "review",
        label: "Prüfung",
        tone: "warn" as const,
        ...compute("review"),
      },
      {
        id: "cancelled",
        label: "Storniert",
        tone: "bad" as const,
        ...compute("cancelled"),
      },
    ];
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (
        vbFilter !== "__all__" &&
        (r.tippgeber || "").trim().toLowerCase() !== vbFilter.toLowerCase()
      ) {
        return false;
      }
      if (globalFilter.trim()) {
        const q = globalFilter.toLowerCase();
        const extraStr = r.data ? Object.values(r.data).join(" ") : "";
        const hay = [
          r.customer_name,
          r.tariff,
          r.tippgeber,
          r.record_date,
          extraStr,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, statusFilter, vbFilter, globalFilter]);

  const totalProvision = useMemo(
    () =>
      filteredRows
        .filter((r) => r.status !== "cancelled")
        .reduce((acc, r) => acc + Number(r.provision ?? 0), 0),
    [filteredRows]
  );

  const openCreateModal = () => {
    const initExtra: Record<string, any> = {};
    for (const col of extraCols) initExtra[col.key] = "";
    setFormState({
      customer_name: "",
      tariff: "",
      tippgeber: vbFilter !== "__all__" ? vbFilter : "Ghaith Abojamil",
      provision: "",
      status: "booked",
      record_date: new Date().toISOString().slice(0, 10),
      data: initExtra,
    });
    setAddOpen(true);
  };

  const openDrawer = (row: any) => {
    const initExtra: Record<string, any> = { ...(row.data || {}) };
    for (const col of extraCols) {
      if (!(col.key in initExtra)) initExtra[col.key] = "";
    }
    setFormState({
      customer_name: row.customer_name || "",
      tariff: row.tariff || "",
      tippgeber: row.tippgeber || "",
      provision: row.provision != null ? String(row.provision) : "",
      status: row.status || "booked",
      record_date: row.record_date || new Date().toISOString().slice(0, 10),
      data: initExtra,
    });
    setDrawerRow(row);
  };

  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const prov = parseFloat(formState.provision.replace(",", ".")) || 0;
    const { error } = await supabase.from("records").insert({
      provider,
      customer_name: formState.customer_name.trim(),
      tariff: formState.tariff.trim() || null,
      tippgeber: formState.tippgeber.trim() || null,
      provision: prov,
      record_date: formState.record_date,
      status: formState.status as any,
      data: formState.data,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Auftrag angelegt.");
      setAddOpen(false);
      fetchData();
    }
  };

  const handleUpdateDrawerRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!drawerRow) return;
    setSaving(true);
    const prov = parseFloat(formState.provision.replace(",", ".")) || 0;
    const { error } = await supabase
      .from("records")
      .update({
        customer_name: formState.customer_name.trim(),
        tariff: formState.tariff.trim() || null,
        tippgeber: formState.tippgeber.trim() || null,
        provision: prov,
        record_date: formState.record_date,
        status: formState.status as any,
        data: formState.data,
      })
      .eq("id", drawerRow.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Auftrag aktualisiert.");
      setDrawerRow(null);
      fetchData();
    }
  };

  const deleteRow = async (id: string) => {
    if (!window.confirm("Diesen Auftrag wirklich löschen?")) return;
    const { error } = await supabase.from("records").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Auftrag gelöscht");
      if (drawerRow?.id === id) setDrawerRow(null);
      setRows((prev) => prev.filter((r) => r.id !== id));
    }
  };

  const exportSingleSheetXlsx = () => {
    const data = filteredRows.map((r) => {
      const base: Record<string, unknown> = {
        Datum: r.record_date ?? "",
        Kunde: r.customer_name ?? "",
        Tarif: r.tariff ?? "",
        "VB / Tippgeber": r.tippgeber ?? "",
        Status: STATUS_LABELS[r.status] ?? r.status,
        Provision: Number(r.provision ?? 0),
      };
      extraCols.forEach((c) => {
        base[c.label] = r.data?.[c.key] ?? "";
      });
      return base;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, meta?.sheetName ?? provider);
    XLSX.writeFile(
      wb,
      `${meta?.label ?? provider}_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  const exportFullAbrechnung = async () => {
    const { data } = await supabase.from("records").select("*");
    if (!data) return;
    const subset =
      vbFilter === "__all__"
        ? data
        : data.filter(
            (r) =>
              (r.tippgeber || "").trim().toLowerCase() ===
              vbFilter.toLowerCase()
          );
    exportMultiSheetAbrechnung(subset as any, {
      vb_name: vbFilter === "__all__" ? "Alle Vermittler" : vbFilter,
      vor_monat_amount: -640,
      vor_monat_label: "TDO-Academy",
      vorschuss_amount: -3650,
      vorschuss_label: "3000 Vorschuss Sep26",
      ohne_mwst_1: 1100,
      mit_mwst_1: 2579.71,
      ohne_mwst_2: 913,
      mit_mwst_2: 2295,
      extra_col_2: 2210,
    });
    toast.success("12-Blatt Gesamtabrechnung exportiert!");
  };

  const handleTriggerPdf = (row: any) => {
    setPdfTargetRow(row);
    if (pdfInputRef.current) {
      pdfInputRef.current.value = "";
      pdfInputRef.current.click();
    }
  };

  const handlePdfSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pdfTargetRow) return;
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Lesefehler"));
        reader.readAsDataURL(file);
      });
      const nextData = {
        ...(pdfTargetRow.data || {}),
        pdf_filename: file.name,
        pdf_data_url: dataUrl,
      };
      const { error } = await supabase
        .from("records")
        .update({ data: nextData })
        .eq("id", pdfTargetRow.id);
      if (error) throw error;
      toast.success(`PDF "${file.name}" gespeichert!`);
      fetchData();
    } catch (err: any) {
      toast.error(err?.message || "PDF-Upload fehlgeschlagen");
    } finally {
      setPdfTargetRow(null);
    }
  };

  const handleOpenPdf = (row: any) => {
    const url = row.data?.pdf_data_url;
    if (!url) {
      toast.info(`Hinterlegte PDF-Referenz: ${row.data?.pdf_filename || "PDF"}`);
      return;
    }
    const win = window.open();
    if (win) {
      win.document.write(
        `<iframe src="${url}" style="width:100%;height:100vh;border:none;" title="${
          row.data?.pdf_filename || "PDF"
        }"></iframe>`
      );
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <input
        ref={pdfInputRef}
        type="file"
        accept="application/pdf,.pdf"
        style={{ display: "none" }}
        onChange={handlePdfSelected}
      />

      <PageHead
        eyebrow={`Anbieter-Sparte · Tabellenblatt "${meta?.sheetName || provider}"`}
        title={`${meta?.label || provider} — Aufträge & Provisionen`}
        sub={`${filteredRows.length} angezeigte Aufträge · ${formatEur(
          totalProvision
        )} Provisionssumme in dieser Auswahl`}
        actions={
          <>
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
              className="btn"
              onClick={exportSingleSheetXlsx}
            >
              <KerfaIcon name="download" size="sm" />
              <span>Blatt .xlsx</span>
            </button>
            <button
              type="button"
              className="btn"
              onClick={exportFullAbrechnung}
            >
              <KerfaIcon name="file" size="sm" />
              <span>12-Blatt Abrechnung</span>
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={openCreateModal}
            >
              <KerfaIcon name="plus" size="sm" />
              <span>Neuer Auftrag</span>
            </button>
          </>
        }
      />

      {headerNav}

      {/* Kerfa 5-Step Fulfillment Pipeline (.of-flow) */}
      <div className="of-flow">
        {flowSteps.map((st, idx) => {
          const active = statusFilter === st.id;
          return (
            <button
              key={st.id}
              type="button"
              className="card of-step"
              onClick={() =>
                setStatusFilter(active && st.id !== "all" ? "all" : st.id)
              }
              style={{
                textAlign: "left",
                cursor: "pointer",
                borderColor: active ? "var(--accent)" : undefined,
                boxShadow: active
                  ? "0 0 0 2px var(--accent-soft), var(--sh-sm)"
                  : undefined,
              }}
            >
              <div className="of-step__top">
                <span className="of-step__label">{st.label}</span>
                <span className={`of-step__n of-step__n--${st.tone}`}>
                  {st.count}
                </span>
              </div>
              <div className="of-step__val">{formatEur(st.sum)}</div>
              {idx < flowSteps.length - 1 && (
                <span className="of-step__arrow" aria-hidden="true">
                  <KerfaIcon name="chevR" size="sm" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Flush Table Card */}
      <div className="card card--flush">
        <div className="chead">
          <div>
            <div className="chead__title">
              {meta?.label || provider} Auftragsliste ({filteredRows.length})
            </div>
            <div className="chead__sub">
              Klicke auf eine Zeile, um alle Sparten-Felder, Status und
              PDF-Belege im Studio-Drawer zu bearbeiten
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <SearchInput
              value={globalFilter}
              onChange={setGlobalFilter}
              placeholder={`In ${meta?.label || provider} suchen…`}
              width={230}
            />

            <select
              className="select"
              value={vbFilter}
              onChange={(e) => setVbFilter(e.target.value)}
              aria-label="Nach VB filtern"
            >
              <option value="__all__">Alle VBs ({vbList.length})</option>
              {vbList.map((vb) => (
                <option key={vb} value={vb}>
                  VB: {vb}
                </option>
              ))}
            </select>

            {(statusFilter !== "all" ||
              vbFilter !== "__all__" ||
              globalFilter) && (
              <button
                type="button"
                className="btn btn--sm btn--ghost"
                onClick={() => {
                  setStatusFilter("all");
                  setVbFilter("__all__");
                  setGlobalFilter("");
                }}
              >
                Filter zurücksetzen
              </button>
            )}
          </div>
        </div>

        <div className="table-wrap">
          {loading ? (
            <div
              style={{
                padding: 36,
                textAlign: "center",
                color: "var(--ink-3)",
              }}
            >
              Lade {meta?.label || provider}-Datensätze…
            </div>
          ) : filteredRows.length === 0 ? (
            <EmptyState
              icon="box"
              title={`Keine ${meta?.label || provider}-Aufträge gefunden`}
              sub="Lege einen neuen Auftrag an oder passe deine Suchfilter an."
              action={
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={openCreateModal}
                >
                  <KerfaIcon name="plus" size="sm" />
                  <span>Ersten Auftrag anlegen</span>
                </button>
              }
            />
          ) : (
            <table className="table table--cards">
              <thead>
                <tr>
                  <th>Kunde / Vertragsnehmer</th>
                  <th>VB / Tippgeber</th>
                  <th>Tarif / Produkt</th>
                  {extraCols.slice(0, 4).map((col) => (
                    <th key={col.key}>{col.label}</th>
                  ))}
                  <th>Status</th>
                  <th className="num">Provision</th>
                  <th className="num">Beleg &amp; Aktion</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((rec) => {
                  const hasPdf = Boolean(
                    rec.data?.pdf_data_url || rec.data?.pdf_filename
                  );
                  return (
                    <tr
                      key={rec.id}
                      onClick={() => openDrawer(rec)}
                      style={{ cursor: "pointer" }}
                    >
                      <td data-label="Kunde">
                        <div className="row-title">
                          <Avatar
                            name={rec.customer_name || meta?.label || provider}
                            size="sm"
                          />
                          <div className="row-title__text">
                            <span className="row-title__main">
                              {rec.customer_name || "—"}
                            </span>
                            <span className="row-title__sub">
                              {rec.record_date || "Ohne Datum"}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td data-label="VB / Tippgeber">
                        <span style={{ fontWeight: 500 }}>
                          {rec.tippgeber || "—"}
                        </span>
                      </td>

                      <td data-label="Tarif">
                        <span
                          style={{
                            fontSize: "var(--fs-xs)",
                            color: "var(--ink-2)",
                          }}
                        >
                          {rec.tariff || "—"}
                        </span>
                      </td>

                      {extraCols.slice(0, 4).map((col) => {
                        const val = rec.data?.[col.key];
                        return (
                          <td key={col.key} data-label={col.label}>
                            <span
                              style={{
                                fontSize: "var(--fs-xs)",
                                color:
                                  val != null && String(val).trim() !== ""
                                    ? "var(--ink)"
                                    : "var(--ink-3)",
                              }}
                            >
                              {val != null && String(val).trim() !== ""
                                ? String(val)
                                : "—"}
                            </span>
                          </td>
                        );
                      })}

                      <td data-label="Status">
                        <Pill tone={STATUS_TONE[rec.status] || "neutral"}>
                          {STATUS_LABELS[rec.status] || rec.status}
                        </Pill>
                      </td>

                      <td data-label="Provision" className="num">
                        <span
                          className="mono"
                          style={{
                            fontWeight: 600,
                            color:
                              rec.provision && Number(rec.provision) > 0
                                ? "var(--ok)"
                                : "var(--ink-2)",
                          }}
                        >
                          {rec.provision != null
                            ? formatEur(Number(rec.provision))
                            : "—"}
                        </span>
                      </td>

                      <td
                        data-label="Aktion"
                        className="num"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          {hasPdf ? (
                            <button
                              type="button"
                              className="btn btn--sm"
                              onClick={() => handleOpenPdf(rec)}
                              title={`PDF: ${rec.data?.pdf_filename || "Beleg"}`}
                            >
                              <KerfaIcon name="file" size="sm" />
                              <span>PDF</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn--sm btn--ghost"
                              onClick={() => handleTriggerPdf(rec)}
                              title="PDF-Beleg anhängen"
                            >
                              <KerfaIcon name="upload" size="sm" />
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn--sm btn--ghost"
                            onClick={() => openDrawer(rec)}
                            title="Bearbeiten"
                          >
                            <KerfaIcon name="edit" size="sm" />
                          </button>
                          {isAdmin && (
                            <button
                              type="button"
                              className="btn btn--sm btn--ghost"
                              onClick={() => deleteRow(rec.id)}
                              title="Löschen"
                              style={{ color: "var(--bad)" }}
                            >
                              <KerfaIcon name="trash" size="sm" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* STUDIO SLIDE-OVER DRAWER */}
      <KerfaDrawer
        open={Boolean(drawerRow)}
        onClose={() => setDrawerRow(null)}
        subtitle={`${meta?.label || provider} · Datensatz ${
          drawerRow?.id?.slice(0, 8) || ""
        }`}
        title={drawerRow?.customer_name || "Auftrag bearbeiten"}
        footer={
          drawerRow && (
            <>
              {isAdmin && (
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={() => deleteRow(drawerRow.id)}
                >
                  <KerfaIcon name="trash" size="sm" />
                  <span>Löschen</span>
                </button>
              )}
              <div style={{ flex: 1 }} />
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setDrawerRow(null)}
              >
                Abbrechen
              </button>
              <button
                type="submit"
                form="drawer-edit-form"
                className="btn btn--primary"
                disabled={saving}
              >
                <KerfaIcon name="check" size="sm" />
                <span>{saving ? "Speichert…" : "Speichern"}</span>
              </button>
            </>
          )
        }
      >
        {drawerRow && (
          <form
            id="drawer-edit-form"
            onSubmit={handleUpdateDrawerRecord}
            style={{ display: "flex", flexDirection: "column", gap: 18 }}
          >
            <div className="steps">
              <div className="step is-done">
                <div className="step__dot" />
                <div className="step__label">Erfasst</div>
              </div>
              <div
                className={`step ${
                  formState.status === "open"
                    ? "is-now"
                    : formState.status === "booked"
                      ? "is-done"
                      : ""
                }`}
              >
                <div className="step__dot" />
                <div className="step__label">Offen / Geprüft</div>
              </div>
              <div
                className={`step ${
                  formState.status === "booked" ? "is-done" : ""
                }`}
              >
                <div className="step__dot" />
                <div className="step__label">Provision gebucht</div>
              </div>
            </div>

            <div className="form-grid">
              <label className="field">
                <span className="field__label">Kundenname</span>
                <input
                  className="input"
                  value={formState.customer_name}
                  onChange={(e) =>
                    setFormState((s) => ({
                      ...s,
                      customer_name: e.target.value,
                    }))
                  }
                />
              </label>

              <label className="field">
                <span className="field__label">VB / Tippgeber</span>
                <input
                  className="input"
                  value={formState.tippgeber}
                  onChange={(e) =>
                    setFormState((s) => ({ ...s, tippgeber: e.target.value }))
                  }
                />
              </label>

              <label className="field">
                <span className="field__label">Tarif / Produkt</span>
                <input
                  className="input"
                  value={formState.tariff}
                  onChange={(e) =>
                    setFormState((s) => ({ ...s, tariff: e.target.value }))
                  }
                />
              </label>

              <label className="field">
                <span className="field__label">Provision (€)</span>
                <input
                  className="input mono"
                  value={formState.provision}
                  onChange={(e) =>
                    setFormState((s) => ({ ...s, provision: e.target.value }))
                  }
                />
              </label>

              <label className="field">
                <span className="field__label">Status</span>
                <select
                  className="select"
                  style={{ width: "100%" }}
                  value={formState.status}
                  onChange={(e) =>
                    setFormState((s) => ({ ...s, status: e.target.value }))
                  }
                >
                  <option value="booked">Gebucht</option>
                  <option value="open">Offen</option>
                  <option value="review">Prüfung</option>
                  <option value="cancelled">Storniert</option>
                </select>
              </label>

              <label className="field">
                <span className="field__label">Datum</span>
                <input
                  type="date"
                  className="input"
                  value={formState.record_date}
                  onChange={(e) =>
                    setFormState((s) => ({ ...s, record_date: e.target.value }))
                  }
                />
              </label>
            </div>

            {extraCols.length > 0 && (
              <div>
                <div
                  style={{
                    fontSize: "var(--fs-xs)",
                    fontWeight: 600,
                    color: "var(--ink-2)",
                    marginBottom: 10,
                  }}
                >
                  Sparten-Felder ({meta?.label || provider})
                </div>
                <div className="form-grid">
                  {extraCols.map((col) => (
                    <label key={col.key} className="field">
                      <span className="field__label">{col.label}</span>
                      <input
                        className="input"
                        value={formState.data[col.key] ?? ""}
                        onChange={(e) =>
                          setFormState((s) => ({
                            ...s,
                            data: { ...s.data, [col.key]: e.target.value },
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}
          </form>
        )}
      </KerfaDrawer>

      {/* CREATE RECORD MODAL */}
      <KerfaModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={`Neuen Auftrag für ${meta?.label || provider} anlegen`}
        subtitle="Wird direkt in die Datenbank und den 12-Blatt Abrechnungsexport aufgenommen."
        maxWidth={640}
        footer={
          <>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setAddOpen(false)}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              form="add-record-form"
              className="btn btn--primary"
              disabled={saving}
            >
              <KerfaIcon name="plus" size="sm" />
              <span>{saving ? "Speichert…" : "Auftrag speichern"}</span>
            </button>
          </>
        }
      >
        <form
          id="add-record-form"
          onSubmit={handleCreateRecord}
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          <div className="form-grid">
            <label className="field">
              <span className="field__label">Kundenname *</span>
              <input
                required
                className="input"
                value={formState.customer_name}
                onChange={(e) =>
                  setFormState((s) => ({
                    ...s,
                    customer_name: e.target.value,
                  }))
                }
                placeholder="Vor- und Nachname"
              />
            </label>

            <label className="field">
              <span className="field__label">VB / Tippgeber</span>
              <input
                className="input"
                value={formState.tippgeber}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, tippgeber: e.target.value }))
                }
                placeholder="z.B. Ghaith Abojamil"
              />
            </label>

            <label className="field">
              <span className="field__label">Tarif / Produkt</span>
              <input
                className="input"
                value={formState.tariff}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, tariff: e.target.value }))
                }
                placeholder="z.B. DSL 100 / SimplyGreen"
              />
            </label>

            <label className="field">
              <span className="field__label">Provision (€)</span>
              <input
                className="input mono"
                value={formState.provision}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, provision: e.target.value }))
                }
                placeholder="0.00"
              />
            </label>

            <label className="field">
              <span className="field__label">Status</span>
              <select
                className="select"
                style={{ width: "100%" }}
                value={formState.status}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, status: e.target.value }))
                }
              >
                <option value="booked">Gebucht</option>
                <option value="open">Offen</option>
                <option value="review">Prüfung</option>
                <option value="cancelled">Storniert</option>
              </select>
            </label>

            <label className="field">
              <span className="field__label">Auftragsdatum</span>
              <input
                type="date"
                className="input"
                value={formState.record_date}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, record_date: e.target.value }))
                }
              />
            </label>
          </div>

          {extraCols.length > 0 && (
            <div className="form-grid">
              {extraCols.map((col) => (
                <label key={col.key} className="field">
                  <span className="field__label">{col.label}</span>
                  <input
                    className="input"
                    value={formState.data[col.key] ?? ""}
                    onChange={(e) =>
                      setFormState((s) => ({
                        ...s,
                        data: { ...s.data, [col.key]: e.target.value },
                      }))
                    }
                  />
                </label>
              ))}
            </div>
          )}
        </form>
      </KerfaModal>

      <ReconciliationDialog
        open={reconcileOpen}
        onOpenChange={setReconcileOpen}
        hubRecords={rows}
        defaultProvider={provider}
        onRecordsChanged={fetchData}
      />
    </div>
  );
}
