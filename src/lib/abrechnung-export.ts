import * as XLSX from "xlsx";
import { ProviderId } from "./providers";

export interface AbrechnungRecord {
  id: string;
  provider: string;
  status: string;
  record_date: string | null;
  customer_name: string | null;
  tariff: string | null;
  tippgeber: string | null;
  provision: number | null;
  notes: string | null;
  data: Record<string, any> | null;
  created_at?: string;
}

export interface VbSettlementSettings {
  vb_name: string;
  vor_monat_amount: number;
  vor_monat_label: string;
  vorschuss_amount: number;
  vorschuss_label: string;
  ohne_mwst_1: number;
  mit_mwst_1: number;
  ohne_mwst_2: number;
  mit_mwst_2: number;
  extra_col_2: number;
}

export const DEFAULT_GHAITH_SETTINGS: VbSettlementSettings = {
  vb_name: "Ghaith Abojamil",
  vor_monat_amount: -640,
  vor_monat_label: "TDO-Academy",
  vorschuss_amount: -3650,
  vorschuss_label: "3000 Vorschuss Sep26",
  ohne_mwst_1: 1100,
  mit_mwst_1: 2579.71,
  ohne_mwst_2: 913,
  mit_mwst_2: 2295,
  extra_col_2: 2210,
};

function formatDateDE(isoOrRaw: string | null | undefined): string {
  if (!isoOrRaw) return "";
  const s = String(isoOrRaw).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  return s;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function calculateProviderSums(records: AbrechnungRecord[]): Record<ProviderId, number> {
  const sums: Record<ProviderId, number> = {
    Strom: 0,
    VF: 0,
    "1u1": 0,
    O2: 0,
    Ayyildiz: 0,
    Check: 0,
    Yourfone: 0,
    DAK: 0,
    BKK: 0,
    Bigdirekt: 0,
    Viactiv: 0,
  };

  for (const r of records) {
    if (r.status === "cancelled") continue;
    const p = r.provider as ProviderId;
    if (p in sums) {
      sums[p] = round2(sums[p] + Number(r.provision ?? 0));
    }
  }
  return sums;
}

/**
 * Generates and downloads the complete 12-sheet Excel Abrechnung (.xlsx)
 * matching the exact layout of the user's Beispielliste.xlsx:
 * Sheets: Übersicht, Strom, VF, 1u1, O2, Ayyildiz, check, Yourfone, DAK, BKK, BigDirek, viactiv
 */
export function exportMultiSheetAbrechnung(
  records: AbrechnungRecord[],
  options?: {
    vbName?: string;
    periodLabel?: string;
    settings?: Partial<VbSettlementSettings>;
    filename?: string;
  }
) {
  const activeRecords = records.filter((r) => r.status !== "cancelled");
  const sums = calculateProviderSums(activeRecords);
  const totalProvision = round2(
    Object.values(sums).reduce((acc, v) => acc + v, 0)
  );

  const isGhaith =
    options?.vbName?.toLowerCase().includes("ghaith") ||
    (!options?.vbName && activeRecords.some((r) => r.tippgeber?.toLowerCase().includes("ghaith")));

  const s: VbSettlementSettings = {
    vb_name: options?.vbName || "Alle Vermittler",
    vor_monat_amount: options?.settings?.vor_monat_amount ?? (isGhaith ? -640 : 0),
    vor_monat_label: options?.settings?.vor_monat_label ?? (isGhaith ? "TDO-Academy" : "Vor Monat"),
    vorschuss_amount: options?.settings?.vorschuss_amount ?? (isGhaith ? -3650 : 0),
    vorschuss_label:
      options?.settings?.vorschuss_label ?? (isGhaith ? "3000 Vorschuss Sep26" : "Vorschuss"),
    ohne_mwst_1: options?.settings?.ohne_mwst_1 ?? (isGhaith ? 1100 : 0),
    mit_mwst_1:
      options?.settings?.mit_mwst_1 ??
      (isGhaith
        ? 2579.71
        : round2(totalProvision + (options?.settings?.vor_monat_amount ?? 0))),
    ohne_mwst_2: options?.settings?.ohne_mwst_2 ?? (isGhaith ? 913 : 0),
    mit_mwst_2: options?.settings?.mit_mwst_2 ?? (isGhaith ? 2295 : 0),
    extra_col_2: options?.settings?.extra_col_2 ?? (isGhaith ? 2210 : 0),
  };

  const sumAfterVorMonat = round2(totalProvision + Number(s.vor_monat_amount || 0));

  const wb = XLSX.utils.book_new();

  // ---------------------------------------------------------------------------
  // 1. Sheet: Übersicht (Exact 25-row layout from Beispielliste.xlsx)
  // ---------------------------------------------------------------------------
  const uebersichtRows: any[][] = [
    ["Strom", sums.Strom || "", "", "", "", ""],
    ["VF", sums.VF || "", "", "", "", ""],
    ["1u1", sums["1u1"] || "", "", "", "", ""],
    ["O2", sums.O2 || "", "", "", "", ""],
    ["Ayyildiz", sums.Ayyildiz || "", "", "", "", ""],
    ["Check", sums.Check || "", "", "", "", ""],
    ["Yourfone", sums.Yourfone || "", "", "", "", ""],
    ["DAK", sums.DAK || "", "", "", "", ""],
    ["BKK", sums.BKK || "", "", "", "", ""],
    ["Bigdirekt", sums.Bigdirekt || "", "", "", "", ""],
    ["viactiv", sums.Viactiv || "", "", "", "", ""],
    ["Summe", totalProvision, "", "", "", ""],
    ["", "", "", "", "", ""],
    ["Vor Monat", s.vor_monat_amount || 0, s.vor_monat_label || "", "", "", ""],
    ["", "", "", "", "", ""],
    ["Summe", sumAfterVorMonat, "", "", "", ""],
    ["", "", "", "", "", ""],
    ["", "", "", "", "", ""],
    ["", "", "", "", "", ""],
    ["", "", "ohne", "mit Mwst", "", ""],
    ["", "", s.ohne_mwst_1 || "", s.mit_mwst_1 || "", "", ""],
    ["", "", s.ohne_mwst_2 || "", s.mit_mwst_2 || "", "", s.extra_col_2 || ""],
    ["", "", "", "", "", ""],
    ["", "", "", "", "", ""],
    ["", s.vorschuss_amount || "", s.vorschuss_label || "", "", "", ""],
  ];
  const wsUebersicht = XLSX.utils.aoa_to_sheet(uebersichtRows);
  wsUebersicht["!cols"] = [
    { wch: 16 },
    { wch: 14 },
    { wch: 24 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, wsUebersicht, "Übersicht");

  // ---------------------------------------------------------------------------
  // 2. Sheet: Strom
  // Columns: VP-Nr. | VP-Name | Unter VP-Nr. | Ihre Position | System | Auftragsnr. | Ihre Auftragsnr. | Buchungsgrund | Anlegedatum | Kunde | Zählernummer | Produkt | Provision | Prov. Datum | Rücklage | Rückl. Datum | Summe pro Vertrag | Verbrauch | Verbrauch NT | Status | USt. Satz
  // ---------------------------------------------------------------------------
  const stromRecs = activeRecords.filter((r) => r.provider === "Strom");
  const stromHeader = [
    "VP-Nr.",
    "VP-Name",
    "Unter VP-Nr.",
    "Ihre Position",
    "System",
    "Auftragsnr.",
    "Ihre Auftragsnr.",
    "Buchungsgrund",
    "Anlegedatum",
    "Kunde",
    "Zählernummer",
    "Produkt",
    "Provision",
    "Prov. Datum",
    "Rücklage",
    "Rückl. Datum",
    "Summe pro Vertrag",
    "Verbrauch",
    "Verbrauch NT",
    "Status",
    "USt. Satz",
  ];
  const stromRows: any[][] = [stromHeader];
  let stromRuecklageSum = 0;
  for (const r of stromRecs) {
    const d = r.data ?? {};
    const prov = Number(r.provision ?? 0);
    const rueckl = Number(d.ruecklage ?? 0);
    stromRuecklageSum = round2(stromRuecklageSum + rueckl);
    const sumVertrag = d.summe_pro_vertrag !== undefined ? Number(d.summe_pro_vertrag) : round2(prov + rueckl);
    stromRows.push([
      d.vp_nr || "11914707",
      d.vp_name || (r.tippgeber ? `Herr ${r.tippgeber}` : ""),
      d.unter_vp_nr !== undefined ? Number(d.unter_vp_nr) : 0,
      d.position || "Stufe 1",
      d.system || "B",
      d.auftragsnr || "",
      d.ihre_auftragsnr || "",
      d.buchungsgrund || r.notes || "Abschlussprovision aus Eigenumsatz",
      d.anlegedatum || formatDateDE(r.record_date),
      r.customer_name || "",
      d.zaehlernummer || "",
      r.tariff || "",
      prov,
      d.prov_datum || formatDateDE(r.record_date),
      rueckl,
      d.rueckl_datum || "",
      sumVertrag,
      d.verbrauch !== undefined && d.verbrauch !== "" ? Number(d.verbrauch) || d.verbrauch : "",
      d.verbrauch_nt !== undefined && d.verbrauch_nt !== "" ? Number(d.verbrauch_nt) || d.verbrauch_nt : "",
      d.status_code || "8000",
      d.ust_satz || "19",
    ]);
  }
  if (stromRecs.length > 0) {
    stromRows.push(["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""]);
    stromRows.push([
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      sums.Strom,
      "",
      stromRuecklageSum,
      "",
      round2(sums.Strom + stromRuecklageSum),
      "",
      "",
      "",
      "",
    ]);
  }
  const wsStrom = XLSX.utils.aoa_to_sheet(stromRows);
  XLSX.utils.book_append_sheet(wb, wsStrom, "Strom");

  // ---------------------------------------------------------------------------
  // 3. Sheet: VF
  // Columns: Datum | PLZ | Kunde | Tarif | VP | Entgelt | Tipgpeber | Provision | Ende | | KN
  // ---------------------------------------------------------------------------
  const vfRecs = activeRecords.filter((r) => r.provider === "VF");
  const vfRows: any[][] = [
    ["Datum", "PLZ", "Kunde", "Tarif", "VP", "Entgelt", "Tipgpeber", "Provision", "Ende", "", "KN"],
  ];
  for (const r of vfRecs) {
    const d = r.data ?? {};
    vfRows.push([
      formatDateDE(r.record_date),
      d.plz || "",
      r.customer_name || "",
      r.tariff || "",
      d.vp || "",
      d.entgelt || "",
      r.tippgeber || "",
      Number(r.provision ?? 0),
      d.ende || "",
      "",
      d.kn || d.weborder_id || "",
    ]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(vfRows), "VF");

  // ---------------------------------------------------------------------------
  // 4. Sheet: 1u1
  // Columns: Datum | Kunde | Tarif | Entgelt | Tipgpeber | Provision
  // ---------------------------------------------------------------------------
  const u1Recs = activeRecords.filter((r) => r.provider === "1u1");
  const u1Rows: any[][] = [["Datum", "Kunde", "Tarif", "Entgelt", "Tipgpeber", "Provision"]];
  for (const r of u1Recs) {
    const d = r.data ?? {};
    u1Rows.push([
      formatDateDE(r.record_date),
      r.customer_name || "",
      r.tariff || "",
      d.entgelt || "",
      r.tippgeber || "",
      Number(r.provision ?? 0),
    ]);
  }
  if (u1Recs.length > 0) {
    u1Rows.push(["", "", "", "", "", ""]);
    u1Rows.push(["", "", "", "", "", sums["1u1"]]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(u1Rows), "1u1");

  // ---------------------------------------------------------------------------
  // 5. Sheet: O2
  // Columns: Datum | PLZ | Kunde | Vertrag | Entgelt | VP | Provision  | Status
  // ---------------------------------------------------------------------------
  const o2Recs = activeRecords.filter((r) => r.provider === "O2");
  const o2Rows: any[][] = [
    ["Datum", "PLZ", "Kunde", "Vertrag", "Entgelt", "VP", "Provision ", "Status"],
  ];
  for (const r of o2Recs) {
    const d = r.data ?? {};
    o2Rows.push([
      formatDateDE(r.record_date),
      d.plz || "",
      r.customer_name || "",
      r.tariff || "",
      d.entgelt || "",
      d.vp || r.tippgeber || "",
      Number(r.provision ?? 0),
      r.status || "open",
    ]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(o2Rows), "O2");

  // ---------------------------------------------------------------------------
  // 6. Sheet: Ayyildiz
  // Columns: Datum | Kunde | Tarif | VP | Provi
  // ---------------------------------------------------------------------------
  const ayRecs = activeRecords.filter((r) => r.provider === "Ayyildiz");
  const ayRows: any[][] = [["Datum", "Kunde", "Tarif", "VP", "Provi"]];
  for (const r of ayRecs) {
    const d = r.data ?? {};
    ayRows.push([
      formatDateDE(r.record_date),
      r.customer_name || "",
      r.tariff || "",
      d.vp || r.tippgeber || "",
      Number(r.provision ?? 0),
    ]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ayRows), "Ayyildiz");

  // ---------------------------------------------------------------------------
  // 7. Sheet: check
  // Columns: Datum | Kunde | Tarif | ID | Entgelt | Tippgeber | Provision |
  // ---------------------------------------------------------------------------
  const checkRecs = activeRecords.filter((r) => r.provider === "Check");
  const checkRows: any[][] = [
    ["Datum", "Kunde", "Tarif", "ID", "Entgelt", "Tippgeber", "Provision", ""],
  ];
  for (const r of checkRecs) {
    const d = r.data ?? {};
    checkRows.push([
      formatDateDE(r.record_date),
      r.customer_name || "",
      r.tariff || "",
      d.tarif_id || d.id || "",
      d.entgelt || "",
      r.tippgeber || "",
      Number(r.provision ?? 0),
      "",
    ]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(checkRows), "check");

  // ---------------------------------------------------------------------------
  // 8. Sheet: Yourfone
  // Columns: Datum  | Name  | Tarif | TG | Provision
  // ---------------------------------------------------------------------------
  const yfRecs = activeRecords.filter((r) => r.provider === "Yourfone");
  const yfRows: any[][] = [["Datum ", "Name ", "Tarif", "TG", "Provision"]];
  for (const r of yfRecs) {
    yfRows.push([
      formatDateDE(r.record_date),
      r.customer_name || "",
      r.tariff || "",
      r.tippgeber || "",
      Number(r.provision ?? 0),
    ]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(yfRows), "Yourfone");

  // ---------------------------------------------------------------------------
  // 9. Sheet: DAK
  // Columns: Datum | Kunde | Tarif | Entgelt | Tippgeber | Provision
  // ---------------------------------------------------------------------------
  const dakRecs = activeRecords.filter((r) => r.provider === "DAK");
  const dakRows: any[][] = [["Datum", "Kunde", "Tarif", "Entgelt", "Tippgeber", "Provision"]];
  for (const r of dakRecs) {
    const d = r.data ?? {};
    dakRows.push([
      formatDateDE(r.record_date),
      r.customer_name || "",
      r.tariff || "",
      d.entgelt || "",
      r.tippgeber || "",
      Number(r.provision ?? 0),
    ]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dakRows), "DAK");

  // ---------------------------------------------------------------------------
  // 10. Sheet: BKK
  // Columns: Datum | Kunde | Mitglied | Entgelt | Tipgpeber | Provision | Spalte1 | Spalte2
  // ---------------------------------------------------------------------------
  const bkkRecs = activeRecords.filter((r) => r.provider === "BKK");
  const bkkRows: any[][] = [
    ["Datum", "Kunde", "Mitglied", "Entgelt", "Tipgpeber", "Provision", "Spalte1", "Spalte2"],
  ];
  for (const r of bkkRecs) {
    const d = r.data ?? {};
    bkkRows.push([
      formatDateDE(r.record_date),
      r.customer_name || "",
      d.mitglied || r.tariff || "",
      d.entgelt || "",
      r.tippgeber || "",
      Number(r.provision ?? 0),
      d.spalte1 || "",
      d.spalte2 || "",
    ]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bkkRows), "BKK");

  // ---------------------------------------------------------------------------
  // 11. Sheet: BigDirek
  // Columns: Datum | Kunde | Eintrittdatum | Geeb. | Tipgpeber | Provision |
  // ---------------------------------------------------------------------------
  const bigRecs = activeRecords.filter((r) => r.provider === "Bigdirekt");
  const bigRows: any[][] = [
    ["Datum", "Kunde", "Eintrittdatum", "Geeb.", "Tipgpeber", "Provision", ""],
  ];
  for (const r of bigRecs) {
    const d = r.data ?? {};
    bigRows.push([
      formatDateDE(r.record_date),
      r.customer_name || "",
      d.eintrittdatum || "",
      d.geb || "",
      r.tippgeber || "",
      Number(r.provision ?? 0),
      "",
    ]);
  }
  if (bigRecs.length > 0) {
    bigRows.push(["", "", "", "", "", "", ""]);
    bigRows.push(["", "", "", "", "", sums.Bigdirekt, ""]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bigRows), "BigDirek");

  // ---------------------------------------------------------------------------
  // 12. Sheet: viactiv
  // Columns: Datum | Kunde | Eintrittdatum | Bonus | Tipgpeber | Provision
  // ---------------------------------------------------------------------------
  const viaRecs = activeRecords.filter((r) => r.provider === "Viactiv");
  const viaRows: any[][] = [
    ["Datum", "Kunde", "Eintrittdatum", "Bonus", "Tipgpeber", "Provision"],
  ];
  for (const r of viaRecs) {
    const d = r.data ?? {};
    viaRows.push([
      formatDateDE(r.record_date),
      r.customer_name || "",
      d.eintrittdatum || "",
      d.bonus || "",
      r.tippgeber || "",
      Number(r.provision ?? 0),
    ]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(viaRows), "viactiv");

  const safeVb = (options?.vbName || "Gesamt").replace(/[^a-zA-Z0-9_-]/g, "_");
  const today = new Date().toISOString().slice(0, 10);
  const outName = options?.filename || `Provisionsabrechnung_${safeVb}_${today}.xlsx`;
  XLSX.writeFile(wb, outName);
}
