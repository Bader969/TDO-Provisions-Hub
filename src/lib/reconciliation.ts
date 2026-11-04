import * as XLSX from "xlsx";
import { ProviderId } from "./providers";
import { AbrechnungRecord } from "./abrechnung-export";

export interface UploadedRecordRow {
  rowIndex: number;
  sheetName: string;
  provider: ProviderId;
  customer_name: string;
  tariff: string;
  tippgeber: string;
  provision: number;
  record_date: string | null;
  auftragsnr?: string;
  zaehlernummer?: string;
  extra: Record<string, any>;
  raw: Record<string, any>;
}

export type MatchCategory = "exact" | "diff" | "missing_in_hub" | "missing_in_list";

export interface ReconciliationItem {
  id: string;
  category: MatchCategory;
  similarity: number;
  uploaded?: UploadedRecordRow;
  hubRecord?: AbrechnungRecord;
  differences: string[];
  provisionDiff: number;
}

export interface ReconciliationSummary {
  fileName: string;
  sheetsProcessed: string[];
  totalUploaded: number;
  totalHubCompared: number;
  exactMatches: ReconciliationItem[];
  diffMatches: ReconciliationItem[];
  missingInHub: ReconciliationItem[];
  missingInList: ReconciliationItem[];
  uploadedProvisionSum: number;
  hubProvisionSum: number;
}

const SHEET_TO_PROVIDER: Record<string, ProviderId> = {
  strom: "Strom",
  vf: "VF",
  vodafone: "VF",
  "1u1": "1u1",
  "1&1": "1u1",
  o2: "O2",
  ayyildiz: "Ayyildiz",
  check: "Check",
  check24: "Check",
  yourfone: "Yourfone",
  dak: "DAK",
  bkk: "BKK",
  bigdirek: "Bigdirekt",
  bigdirekt: "Bigdirekt",
  "big direkt": "Bigdirekt",
  viactiv: "Viactiv",
};

export function normalizePersonName(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .toLowerCase()
    .replace(/\b(herr|frau|dr|prof|familie|fa)\b\.?/gi, " ")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[,._\-/()]/g, " ")
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

export function nameSimilarity(nameA: string | null | undefined, nameB: string | null | undefined): number {
  const normA = normalizePersonName(nameA);
  const normB = normalizePersonName(nameB);
  if (!normA || !normB) return 0;
  if (normA === normB) return 1;

  // Check if all tokens of the shorter name are contained in the longer name
  const tokensA = normA.split(" ");
  const tokensB = normB.split(" ");
  const shorter = tokensA.length <= tokensB.length ? tokensA : tokensB;
  const longer = tokensA.length <= tokensB.length ? tokensB : tokensA;
  if (shorter.length >= 2 && shorter.every((t) => longer.includes(t))) {
    return 0.96;
  }

  const maxLen = Math.max(normA.length, normB.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(normA, normB) / maxLen;
}

function parseExcelDateToIso(val: any): string | null {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "number" && val > 20000 && val < 90000) {
    const utcDays = Math.floor(val - 25569);
    const d = new Date(utcDays * 86400 * 1000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(val).trim();
  const mDe = /^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/.exec(s);
  if (mDe) {
    const dd = mDe[1].padStart(2, "0");
    const mm = mDe[2].padStart(2, "0");
    const yyyy = mDe[3].length === 2 ? `20${mDe[3]}` : mDe[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  const mIso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (mIso) return mIso[0];
  return null;
}

function parseGermanNumber(val: any): number {
  if (typeof val === "number") return Number.isFinite(val) ? Math.round(val * 100) / 100 : 0;
  if (!val) return 0;
  const s = String(val)
    .replace(/[€\s]/g, "")
    .replace(/\.(?=\d{3}(?:,|$))/g, "")
    .replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function cleanVbName(raw: string): string {
  return raw.replace(/^(herr|frau)\s+/i, "").trim();
}

/**
 * Parses an uploaded Excel (.xlsx/.xls) or CSV file into structured UploadedRecordRow items.
 * Automatically handles multi-sheet workbooks (like Beispielliste.xlsx) and single-sheet lists.
 */
export async function parseUploadedExcelOrCsv(
  file: File,
  fallbackProvider: ProviderId = "Strom",
  defaultTippgeber: string = ""
): Promise<{ rows: UploadedRecordRow[]; sheetsProcessed: string[] }> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });

  const extracted: UploadedRecordRow[] = [];
  const sheetsProcessed: string[] = [];

  for (const sheetName of wb.SheetNames) {
    const lowerSheet = sheetName.trim().toLowerCase();
    // Skip pure summary sheet "Übersicht"
    if (lowerSheet === "übersicht" || lowerSheet === "uebersicht" || lowerSheet === "summary") {
      continue;
    }

    const detectedProvider: ProviderId =
      SHEET_TO_PROVIDER[lowerSheet] || fallbackProvider;

    const ws = wb.Sheets[sheetName];
    const aoa = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "" });
    if (aoa.length < 2) continue;

    // Find header row (first row with at least 2 non-empty string cells)
    let headerIdx = 0;
    for (let i = 0; i < Math.min(5, aoa.length); i++) {
      const nonEmpty = aoa[i].filter((c) => String(c).trim().length > 0);
      if (nonEmpty.length >= 2) {
        headerIdx = i;
        break;
      }
    }

    const headers = aoa[headerIdx].map((h) => String(h || "").trim());
    const findCol = (patterns: RegExp[]): number => {
      for (const pat of patterns) {
        const idx = headers.findIndex((h) => pat.test(h));
        if (idx >= 0) return idx;
      }
      return -1;
    };

    const colCustomer = findCol([/^kunde$/i, /^name$/i, /kundenname/i, /mitgliedsname/i, /versicherter/i]);
    const colVorname = findCol([/^vorname$/i]);
    const colNachname = findCol([/^nachname$/i, /^familienname$/i]);
    const colTariff = findCol([/^produkt$/i, /^tarif$/i, /^vertrag$/i, /^mitglied$/i, /^bonus$/i]);
    const colProvision = findCol([/^provision/i, /^provi$/i, /^betrag$/i, /^summe pro vertrag$/i]);
    const colTippgeber = findCol([/^tippgeber$/i, /^tipgpeber$/i, /^tg$/i, /^vp-name$/i, /^vp$/i, /^vermittler$/i]);
    const colDate = findCol([/^anlegedatum$/i, /^datum/i, /^auftragsdatum$/i]);
    const colAuftragsnr = findCol([/^auftragsnr/i, /^weborder/i, /^kn$/i, /^id$/i, /^ak-nr/i]);
    const colZaehler = findCol([/^zählernummer/i, /^zaehlernummer/i]);
    const colBuchungsgrund = findCol([/^buchungsgrund$/i, /^notiz/i, /^status$/i]);

    let sheetRowCount = 0;

    for (let rIdx = headerIdx + 1; rIdx < aoa.length; rIdx++) {
      const row = aoa[rIdx];
      if (!row || row.every((c) => c === "" || c === null || c === undefined)) continue;

      let customerName = "";
      if (colCustomer >= 0) {
        customerName = String(row[colCustomer] || "").trim();
      } else if (colVorname >= 0 || colNachname >= 0) {
        const vn = colVorname >= 0 ? String(row[colVorname] || "").trim() : "";
        const nn = colNachname >= 0 ? String(row[colNachname] || "").trim() : "";
        customerName = `${vn} ${nn}`.trim();
      }

      const auftragsnr = colAuftragsnr >= 0 ? String(row[colAuftragsnr] || "").trim() : "";
      // Skip bottom summary/total rows where customerName and auftragsnr are both empty
      if (!customerName && !auftragsnr) continue;
      if (/^(summe|gesamt|total)$/i.test(customerName)) continue;

      const tariff =
        colTariff >= 0 && row[colTariff]
          ? String(row[colTariff]).trim()
          : detectedProvider === "Bigdirekt"
          ? "BIG direkt gesund"
          : detectedProvider;

      const provision = colProvision >= 0 ? parseGermanNumber(row[colProvision]) : 0;
      const rawTippgeber =
        colTippgeber >= 0 && row[colTippgeber]
          ? cleanVbName(String(row[colTippgeber]))
          : defaultTippgeber;

      const recordDate = colDate >= 0 ? parseExcelDateToIso(row[colDate]) : null;
      const zaehlernummer = colZaehler >= 0 ? String(row[colZaehler] || "").trim() : "";

      const extra: Record<string, any> = {};
      const rawObj: Record<string, any> = {};
      headers.forEach((h, cIdx) => {
        if (!h) return;
        const val = row[cIdx];
        if (val !== "" && val !== null && val !== undefined) {
          rawObj[h] = val;
        }
      });

      if (detectedProvider === "Strom") {
        extra.vp_nr = String(row[0] || "");
        extra.vp_name = String(row[1] || "");
        extra.unter_vp_nr = String(row[2] ?? "0");
        extra.position = String(row[3] || "Stufe 1");
        extra.system = String(row[4] || "B");
        extra.auftragsnr = auftragsnr;
        extra.ihre_auftragsnr = String(row[6] || "");
        extra.buchungsgrund = colBuchungsgrund >= 0 ? String(row[colBuchungsgrund] || "") : "";
        extra.zaehlernummer = zaehlernummer;
        extra.verbrauch = row[17] !== undefined ? String(row[17]) : "";
      } else {
        if (auftragsnr) extra.auftragsnr = auftragsnr;
        if (zaehlernummer) extra.zaehlernummer = zaehlernummer;
      }

      extracted.push({
        rowIndex: rIdx + 1,
        sheetName,
        provider: detectedProvider,
        customer_name: customerName,
        tariff,
        tippgeber: rawTippgeber,
        provision,
        record_date: recordDate,
        auftragsnr: auftragsnr || undefined,
        zaehlernummer: zaehlernummer || undefined,
        extra,
        raw: rawObj,
      });
      sheetRowCount++;
    }

    if (sheetRowCount > 0) {
      sheetsProcessed.push(sheetName);
    }
  }

  return { rows: extracted, sheetsProcessed };
}

/**
 * Compares uploaded Excel/CSV rows against existing Hub records.
 */
export function reconcileRecords(
  fileName: string,
  uploadedRows: UploadedRecordRow[],
  hubRecords: AbrechnungRecord[],
  sheetsProcessed: string[] = []
): ReconciliationSummary {
  const usedHubIds = new Set<string>();
  const exactMatches: ReconciliationItem[] = [];
  const diffMatches: ReconciliationItem[] = [];
  const missingInHub: ReconciliationItem[] = [];

  for (let i = 0; i < uploadedRows.length; i++) {
    const up = uploadedRows[i];

    // Find best matching unused Hub record
    let bestHub: AbrechnungRecord | null = null;
    let bestScore = 0;

    for (const hub of hubRecords) {
      if (usedHubIds.has(hub.id)) continue;

      // Provider match gives priority
      const sameProvider = hub.provider === up.provider;
      if (!sameProvider && sheetsProcessed.length > 1) continue;

      const hubAuftrag = String(hub.data?.auftragsnr || hub.data?.weborder_id || "").trim();
      const hubBuchungsgrund = String(hub.data?.buchungsgrund || hub.notes || "").trim();
      const upBuchungsgrund = String(up.extra?.buchungsgrund || "").trim();

      const sim = nameSimilarity(up.customer_name, hub.customer_name);
      if (sim < 0.75 && (!up.auftragsnr || up.auftragsnr !== hubAuftrag)) {
        continue;
      }

      let score = sim * 100;
      if (up.auftragsnr && hubAuftrag && up.auftragsnr === hubAuftrag) {
        score += 30;
      }
      // If multiple rows for same customer (like Strom Eigenumsatz vs Teamumsatz), prefer matching provision & buchungsgrund
      if (Math.abs(Number(hub.provision ?? 0) - up.provision) < 0.01) {
        score += 20;
      }
      if (upBuchungsgrund && hubBuchungsgrund && upBuchungsgrund === hubBuchungsgrund) {
        score += 15;
      }

      if (score > bestScore) {
        bestScore = score;
        bestHub = hub;
      }
    }

    if (bestHub) {
      usedHubIds.add(bestHub.id);
      const hubProv = Number(bestHub.provision ?? 0);
      const provDiff = Math.round((up.provision - hubProv) * 100) / 100;
      const sim = nameSimilarity(up.customer_name, bestHub.customer_name);

      const diffs: string[] = [];
      if (Math.abs(provDiff) >= 0.01) {
        diffs.push(`Provision: Liste ${up.provision.toFixed(2)} € vs. Hub ${hubProv.toFixed(2)} €`);
      }
      if (sim < 0.99) {
        diffs.push(`Schreibweise: "${up.customer_name}" vs. "${bestHub.customer_name}"`);
      }
      if (up.provider !== bestHub.provider) {
        diffs.push(`Anbieter: ${up.provider} vs. ${bestHub.provider}`);
      }

      if (diffs.length === 0) {
        exactMatches.push({
          id: `exact-${i}`,
          category: "exact",
          similarity: sim,
          uploaded: up,
          hubRecord: bestHub,
          differences: [],
          provisionDiff: 0,
        });
      } else {
        diffMatches.push({
          id: `diff-${i}`,
          category: "diff",
          similarity: sim,
          uploaded: up,
          hubRecord: bestHub,
          differences: diffs,
          provisionDiff: provDiff,
        });
      }
    } else {
      missingInHub.push({
        id: `missing-hub-${i}`,
        category: "missing_in_hub",
        similarity: 0,
        uploaded: up,
        differences: ["In hochgeladener Liste vorhanden, fehlt im Hub"],
        provisionDiff: up.provision,
      });
    }
  }

  const missingInList: ReconciliationItem[] = hubRecords
    .filter((h) => !usedHubIds.has(h.id))
    .map((h, idx) => ({
      id: `missing-list-${idx}`,
      category: "missing_in_list" as const,
      similarity: 0,
      hubRecord: h,
      differences: ["Im Hub vorhanden, fehlt in hochgeladener Liste"],
      provisionDiff: -Number(h.provision ?? 0),
    }));

  const uploadedProvisionSum =
    Math.round(uploadedRows.reduce((acc, r) => acc + r.provision, 0) * 100) / 100;
  const hubProvisionSum =
    Math.round(hubRecords.reduce((acc, r) => acc + Number(r.provision ?? 0), 0) * 100) / 100;

  return {
    fileName,
    sheetsProcessed,
    totalUploaded: uploadedRows.length,
    totalHubCompared: hubRecords.length,
    exactMatches,
    diffMatches,
    missingInHub,
    missingInList,
    uploadedProvisionSum,
    hubProvisionSum,
  };
}

export function exportReconciliationReport(summary: ReconciliationSummary) {
  const wb = XLSX.utils.book_new();

  const overviewRows = [
    ["TDO Provisions-Hub — Listen-Abgleich Bericht"],
    ["Datei", summary.fileName],
    ["Geprüfte Tabellenblätter", summary.sheetsProcessed.join(", ") || "Standard"],
    [""],
    ["Kategorie", "Anzahl", "Details"],
    ["Exakte Übereinstimmungen", summary.exactMatches.length, "Kunde & Provision identisch"],
    ["Abweichungen (Provision / Name)", summary.diffMatches.length, "Treffer mit Differenz"],
    ["Nur in Excel-Liste (Fehlt im Hub)", summary.missingInHub.length, "Kann mit 1 Klick importiert werden"],
    ["Nur im Hub (Fehlt in Excel-Liste)", summary.missingInList.length, "Im Hub gebucht, nicht in Datei"],
    [""],
    ["Provisionssumme Excel-Liste", summary.uploadedProvisionSum],
    ["Provisionssumme Hub", summary.hubProvisionSum],
    ["Differenz Gesamt", Math.round((summary.uploadedProvisionSum - summary.hubProvisionSum) * 100) / 100],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(overviewRows), "Zusammenfassung");

  if (summary.diffMatches.length > 0) {
    const rows = summary.diffMatches.map((m) => ({
      Anbieter: m.uploaded?.provider || m.hubRecord?.provider || "",
      "Kunde (Liste)": m.uploaded?.customer_name || "",
      "Kunde (Hub)": m.hubRecord?.customer_name || "",
      Tarif: m.uploaded?.tariff || m.hubRecord?.tariff || "",
      Tippgeber: m.uploaded?.tippgeber || m.hubRecord?.tippgeber || "",
      "Provision (Liste)": m.uploaded?.provision ?? 0,
      "Provision (Hub)": Number(m.hubRecord?.provision ?? 0),
      Differenz: m.provisionDiff,
      Details: m.differences.join(" | "),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Abweichungen");
  }

  if (summary.missingInHub.length > 0) {
    const rows = summary.missingInHub.map((m) => ({
      Blatt: m.uploaded?.sheetName || "",
      Anbieter: m.uploaded?.provider || "",
      Datum: m.uploaded?.record_date || "",
      Kunde: m.uploaded?.customer_name || "",
      Tarif: m.uploaded?.tariff || "",
      Tippgeber: m.uploaded?.tippgeber || "",
      Provision: m.uploaded?.provision ?? 0,
      Auftragsnr: m.uploaded?.auftragsnr || "",
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Fehlt_im_Hub");
  }

  if (summary.missingInList.length > 0) {
    const rows = summary.missingInList.map((m) => ({
      Anbieter: m.hubRecord?.provider || "",
      Datum: m.hubRecord?.record_date || "",
      Kunde: m.hubRecord?.customer_name || "",
      Tarif: m.hubRecord?.tariff || "",
      Tippgeber: m.hubRecord?.tippgeber || "",
      Provision: Number(m.hubRecord?.provision ?? 0),
      Status: m.hubRecord?.status || "",
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Fehlt_in_Liste");
  }

  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Listen_Abgleich_${today}.xlsx`);
}
