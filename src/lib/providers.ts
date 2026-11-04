export const PROVIDERS = [
  { id: "Strom", label: "Strom", sheetName: "Strom", color: "oklch(0.75 0.18 80)", path: "strom" },
  { id: "VF", label: "Vodafone", sheetName: "VF", color: "oklch(0.65 0.22 25)", path: "vodafone" },
  { id: "1u1", label: "1&1", sheetName: "1u1", color: "oklch(0.55 0.2 260)", path: "einsundeins" },
  { id: "O2", label: "O2", sheetName: "O2", color: "oklch(0.6 0.2 200)", path: "o2" },
  { id: "Ayyildiz", label: "Ayyildiz", sheetName: "Ayyildiz", color: "oklch(0.6 0.22 30)", path: "ayyildiz" },
  { id: "Check", label: "Check24", sheetName: "Check", color: "oklch(0.7 0.18 140)", path: "check" },
  { id: "Yourfone", label: "Yourfone", sheetName: "Yourfone", color: "oklch(0.65 0.2 320)", path: "yourfone" },
  { id: "DAK", label: "DAK", sheetName: "DAK", color: "oklch(0.55 0.18 220)", path: "dak" },
  { id: "BKK", label: "BKK", sheetName: "BKK", color: "oklch(0.6 0.18 160)", path: "bkk" },
  { id: "Bigdirekt", label: "BIG direkt", sheetName: "Bigdirekt", color: "oklch(0.62 0.19 195)", path: "bigdirekt" },
  { id: "Viactiv", label: "VIACTIV", sheetName: "viactiv", color: "oklch(0.68 0.19 125)", path: "viactiv" },
] as const;

export type ProviderId = (typeof PROVIDERS)[number]["id"];

export const PROVIDER_IDS = PROVIDERS.map((p) => p.id) as ProviderId[];

export function providerByPath(path: string) {
  return PROVIDERS.find((p) => p.path === path.toLowerCase());
}

export function providerById(id: string) {
  return PROVIDERS.find((p) => p.id.toLowerCase() === id.toLowerCase());
}

export function providerBySheetOrName(raw: string): ProviderId | null {
  const s = (raw || "").trim().toLowerCase();
  if (!s) return null;
  if (s.includes("strom") || s.includes("gas") || s.includes("energie")) return "Strom";
  if (s === "vf" || s.includes("vodafone")) return "VF";
  if (s === "1u1" || s.includes("1&1") || s.includes("einsundeins") || s.includes("1und1")) return "1u1";
  if (s === "o2" || s.startsWith("o2 ")) return "O2";
  if (s.includes("ayyildiz") || s.includes("ay yildiz")) return "Ayyildiz";
  if (s.includes("check") || s.includes("kfz")) return "Check";
  if (s.includes("yourfone")) return "Yourfone";
  if (s.includes("dak")) return "DAK";
  if (s.includes("big")) return "Bigdirekt";
  if (s.includes("viactiv")) return "Viactiv";
  if (s.includes("bkk") || s.includes("novitas") || s.includes("gildemeister")) return "BKK";
  return null;
}

// Provider-specific extra columns (rendered from `data` JSONB in RecordsTable)
export const PROVIDER_EXTRA_COLUMNS: Record<ProviderId, { key: string; label: string }[]> = {
  Strom: [
    { key: "vp_nr", label: "VP-Nr." },
    { key: "vp_name", label: "VP-Name" },
    { key: "auftragsnr", label: "Auftragsnr." },
    { key: "ihre_auftragsnr", label: "Ihre Auftragsnr." },
    { key: "buchungsgrund", label: "Buchungsgrund" },
    { key: "zaehlernummer", label: "Zählernummer" },
    { key: "verbrauch", label: "Verbrauch" },
    { key: "prov_datum", label: "Prov. Datum" },
  ],
  VF: [
    { key: "plz", label: "PLZ" },
    { key: "vp", label: "VP" },
    { key: "entgelt", label: "Entgelt" },
    { key: "ende", label: "Ende" },
    { key: "kn", label: "KN / Weborder" },
  ],
  "1u1": [
    { key: "entgelt", label: "Entgelt" },
    { key: "vp", label: "VP" },
  ],
  O2: [
    { key: "tdo", label: "TDO / SubD. ID" },
    { key: "vp", label: "VP / Kundentyp" },
    { key: "angebote", label: "Angebote" },
    { key: "plz", label: "PLZ" },
    { key: "entgelt", label: "Entgelt" },
    { key: "pdf_filename", label: "PDF" },
  ],
  Ayyildiz: [
    { key: "subd_id", label: "SubD. ID" },
    { key: "vp", label: "VP" },
  ],
  Check: [
    { key: "tarif_id", label: "ID / Tarif ID" },
    { key: "entgelt", label: "Entgelt" },
    { key: "vp", label: "VP / Kundentyp" },
  ],
  Yourfone: [
    { key: "ak_nr", label: "AK-Nr." },
    { key: "vp", label: "VP" },
  ],
  DAK: [
    { key: "entgelt", label: "Entgelt" },
    { key: "start", label: "Start" },
    { key: "vp", label: "VP" },
  ],
  BKK: [
    { key: "mitglied", label: "Mitglied / Bonus" },
    { key: "entgelt", label: "Entgelt / Status" },
    { key: "vp", label: "VP" },
    { key: "pdf_filename", label: "PDF" },
  ],
  Bigdirekt: [
    { key: "eintrittdatum", label: "Eintrittdatum" },
    { key: "geburtsdatum", label: "Geb." },
    { key: "vp", label: "VP" },
  ],
  Viactiv: [
    { key: "eintrittdatum", label: "Eintrittdatum" },
    { key: "bonus", label: "Bonus" },
    { key: "vp", label: "VP" },
  ],
};
