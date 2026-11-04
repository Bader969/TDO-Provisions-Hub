import { ProviderId } from "./providers";

export const TDO_GROUP_CHAT_ID = "120363433620322465@g.us";
export const DEFAULT_OPENWA_BASE_URL = "http://167.235.29.228:2785";
export const DEFAULT_OPENWA_API_KEY =
  "owa_k1_b1d9b45c70843a832246a4a29f947940aefc7bce442c6e179c4625cf383960a1";
export const DEFAULT_OPENWA_SESSION_ID = "9228e9e5-9e4a-4a72-9a88-aeb2ef082677";

export interface ParsedWhatsAppRecord {
  provider: ProviderId | "UNKNOWN";
  customer_name: string | null;
  tariff: string | null;
  tippgeber: string | null;
  provision: number | null;
  record_date: string | null; // YYYY-MM-DD
  extra: Record<string, any>;
}

export interface ParseMessageResult {
  isSeparator: boolean;
  provider: ProviderId | "UNKNOWN";
  lines: ParsedWhatsAppRecord[];
}

/**
 * Checks if a message body is a separator (e.g. ".", ".\n\n:", "...") or empty.
 */
export function isSeparatorMessage(body: string): boolean {
  const clean = (body || "").trim();
  if (!clean) return true;
  // Pure punctuation / dots / colons / whitespace
  if (/^[.\s:;,\-_+*~]+$/.test(clean)) return true;
  return false;
}

/**
 * Parses German date DD.MM.YYYY or D.M.YY into YYYY-MM-DD
 */
export function parseGermanDateToIso(raw: string): string | null {
  const clean = (raw || "").trim();
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/.exec(clean);
  if (!m) return null;
  const dd = m[1].padStart(2, "0");
  const mm = m[2].padStart(2, "0");
  const yyyy = m[3].length === 2 ? `20${m[3]}` : m[3];
  const dNum = Number(dd);
  const mNum = Number(mm);
  const yNum = Number(yyyy);
  if (mNum >= 1 && mNum <= 12 && dNum >= 1 && dNum <= 31 && yNum >= 1920 && yNum <= 2100) {
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

/**
 * Detects provider from a line of text.
 * Returns { provider, tariffHint, isPureProviderLine, bonusHint }
 */
function matchProviderLine(line: string): {
  provider: ProviderId;
  tariffHint?: string;
  isPureProviderLine: boolean;
  bonusHint?: string;
} | null {
  const clean = line.trim();
  const lower = clean.toLowerCase();

  // Ignore TDO number lines, Angebote, VP lines, Stammkunde lines
  if (/^tdo\b/i.test(clean)) return null;
  if (/^\*?angebote\b/i.test(clean)) return null;
  if (/^vp\b/i.test(clean)) return null;
  if (/^stammkunde\b/i.test(clean)) return null;

  // 1. O2 (e.g. "O2", "O2 Max", "O2 Mobile M", "O2 DSL")
  if (/^o2\b/i.test(clean)) {
    const rest = clean.replace(/^o2\s*/i, "").trim();
    return {
      provider: "O2",
      tariffHint: rest ? clean : undefined,
      isPureProviderLine: !rest,
    };
  }

  // 2. Vodafone / VF
  if (/^(?:vf|vodafone)\b/i.test(clean)) {
    const rest = clean.replace(/^(?:vf|vodafone)\s*/i, "").trim();
    return {
      provider: "VF",
      tariffHint: rest ? clean : undefined,
      isPureProviderLine: !rest,
    };
  }

  // 3. 1&1 / 1u1
  if (/^(?:1&1|1u1|1und1|einsundeins)\b/i.test(clean)) {
    const rest = clean.replace(/^(?:1&1|1u1|1und1|einsundeins)\s*/i, "").trim();
    return {
      provider: "1u1",
      tariffHint: rest ? clean : undefined,
      isPureProviderLine: !rest,
    };
  }

  // 4. Strom & Gas / Strom / Gas / Energie
  if (/\b(?:strom\s*&\s*gas|strom\s+und\s+gas|strom|erdgas|gas|energie|vattenfall|ewe|lekker|lichtblick|süwag|enviam)\b/i.test(clean)) {
    const isPure = /^(?:strom|gas|energie)$/i.test(clean);
    return {
      provider: "Strom",
      tariffHint: clean,
      isPureProviderLine: isPure,
    };
  }

  // 5. Kfz / Check24 / Check
  if (/^(?:kfz|check24|check)\b/i.test(clean) || /\bkfz[-\s]*versicherung\b/i.test(clean)) {
    const isPure = /^(?:check24|check)$/i.test(clean);
    return {
      provider: "Check",
      tariffHint: isPure ? undefined : clean,
      isPureProviderLine: isPure,
    };
  }

  // 6. Ayyildiz
  if (/\bay\s*yildiz\b/i.test(clean)) {
    const rest = clean.replace(/\bay\s*yildiz\b/i, "").trim();
    return {
      provider: "Ayyildiz",
      tariffHint: rest ? clean : undefined,
      isPureProviderLine: !rest,
    };
  }

  // 7. Yourfone
  if (/\byourfone\b/i.test(clean)) {
    const rest = clean.replace(/\byourfone\b/i, "").trim();
    return {
      provider: "Yourfone",
      tariffHint: rest ? clean : undefined,
      isPureProviderLine: !rest,
    };
  }

  // 8. DAK
  if (/\bdak\b/i.test(clean)) {
    const bonusMatch = /(\d+\s*€)/.exec(clean);
    const isPure = /^dak(?:-gesundheit)?$/i.test(clean);
    return {
      provider: "DAK",
      tariffHint: isPure ? undefined : clean,
      isPureProviderLine: isPure,
      bonusHint: bonusMatch ? bonusMatch[1] : undefined,
    };
  }

  // 9. BIG direkt / Bigdirekt
  if (/\bbig(?:\s*direkt)?\b/i.test(clean)) {
    const bonusMatch = /(\d+\s*€)/.exec(clean);
    const isPure = /^big(?:\s*direkt(?:\s*gesund)?)?$/i.test(clean);
    return {
      provider: "Bigdirekt",
      tariffHint: isPure ? undefined : clean,
      isPureProviderLine: isPure,
      bonusHint: bonusMatch ? bonusMatch[1] : undefined,
    };
  }

  // 10. VIACTIV
  if (/\bviactiv\b/i.test(clean)) {
    const bonusMatch = /(\d+\s*€)/.exec(clean);
    const isPure = /^viactiv$/i.test(clean);
    return {
      provider: "Viactiv",
      tariffHint: isPure ? undefined : clean,
      isPureProviderLine: isPure,
      bonusHint: bonusMatch ? bonusMatch[1] : undefined,
    };
  }

  // 11. BKK / Novitas BKK / BKK GS / BKK_400€
  if (/\b(?:bkk|novitas|gildemeister)\b/i.test( lower.replace(/_/g, " ") )) {
    const bonusMatch = /(\d+\s*€)/.exec(clean);
    const isPure = /^(?:bkk|novitas(?:\s*bkk)?|bkk\s*gs)$/i.test(clean.replace(/_/g, " "));
    return {
      provider: "BKK",
      tariffHint: isPure ? undefined : clean.replace(/_/g, " "),
      isPureProviderLine: isPure,
      bonusHint: bonusMatch ? bonusMatch[1] : undefined,
    };
  }

  return null;
}

/**
 * Deterministic parser for TDO WhatsApp Group messages (120363433620322465@g.us)
 * and standard multi-line contract messages.
 *
 * Examples handled:
 * 1) "Ghrery, Reda\n03.06.2026\nO2\nDSL100 + Router 4,99\nTDO: 6321\n*Angebote  tablet+headset+smartwatsch*\nStammkunde GO\nMosab GO \nMosab GO"
 * 2) "Alnahar, Mohammad\nKfz\nStammkunde H\nMazen H\nMazen H"
 * 3) "Kador, Youssef \n03.06.2026\nStrom & Gas \nVP Haidara H\nSiham H\nSiham H"
 * 4) "03.06.2026\nHiba Shahien\nO2 Max\nTDO 7940\nVP Telenergie\nAboud"
 * 5) "Mahmoud Abdulaziz\nDAK\nTelenergie"
 * 6) "Azad Sidqi Saeed Saaed\nFamilienversicherung \nBKK_400€\nTelenergie"
 */
export function parseTdoWhatsAppMessage(
  body: string,
  fallbackDateIso?: string,
  pdfFilename?: string | null
): ParseMessageResult | null {
  if (isSeparatorMessage(body)) {
    return { isSeparator: true, provider: "UNKNOWN", lines: [] };
  }

  const rawLines = body
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^[.\s:;,\-_]+$/.test(l));

  if (rawLines.length < 2) {
    return null;
  }

  // Deduplicate identical consecutive trailing lines (e.g. "Mosab GO \n Mosab GO", "Mazen H \n Mazen H", "Siham H \n Siham H")
  const lines = [...rawLines];
  while (
    lines.length >= 2 &&
    lines[lines.length - 1].toLowerCase() === lines[lines.length - 2].toLowerCase()
  ) {
    lines.pop();
  }

  let recordDate: string | null = null;
  let birthDate: string | null = null;
  let detectedProvider: ProviderId | null = null;
  let providerTariffHint: string | undefined;
  let bonusHint: string | undefined;
  const extra: Record<string, any> = {};
  if (pdfFilename) {
    extra.pdf_filename = pdfFilename;
  }

  const consumedIndices = new Set<number>();

  // Pass 1: Extract explicit metadata lines (Date, TDO, Angebote, VP, Stammkunde, Provider)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if pure date line DD.MM.YYYY
    const isoDate = parseGermanDateToIso(line);
    if (isoDate) {
      const year = Number(isoDate.slice(0, 4));
      if (!recordDate && year >= 2024) {
        recordDate = isoDate;
        consumedIndices.add(i);
        continue;
      } else if (!birthDate && year < 2024) {
        birthDate = line;
        extra.geburtsdatum = line;
        consumedIndices.add(i);
        continue;
      }
    }

    // Check TDO number: "TDO: 6321" or "TDO 7940"
    const tdoMatch = /^tdo\s*[:\-]?\s*(\S+.*)$/i.exec(line);
    if (tdoMatch) {
      const tdoVal = tdoMatch[1].trim();
      extra.tdo = tdoVal;
      extra.subd_id = tdoVal;
      consumedIndices.add(i);
      continue;
    }

    // Check Angebote: "*Angebote tablet+headset+smartwatsch*" or "Angebote ..."
    const angeboteMatch = /^\*?angebote\s*[:\-]?\s*(.+?)\*?$/i.exec(line);
    if (angeboteMatch) {
      extra.angebote = angeboteMatch[1].replace(/\*+/g, "").trim();
      consumedIndices.add(i);
      continue;
    }

    // Check VP line: "VP Haidara H", "VP Telenergie"
    const vpMatch = /^vp\s*[:\-]?\s*(.+)$/i.exec(line);
    if (vpMatch) {
      const vpVal = vpMatch[1].trim();
      extra.vp = `VP ${vpVal}`;
      extra.vp_name = `VP ${vpVal}`;
      consumedIndices.add(i);
      continue;
    }

    // Check Stammkunde / Neukunde line: "Stammkunde GO", "Stammkunde H"
    if (/^(?:stammkunde|neukunde)\b/i.test(line)) {
      extra.kundentyp = line;
      if (!extra.vp) extra.vp = line;
      consumedIndices.add(i);
      continue;
    }

    // Check Provider match
    const provMatch = matchProviderLine(line);
    if (provMatch && !detectedProvider) {
      detectedProvider = provMatch.provider;
      if (provMatch.tariffHint) providerTariffHint = provMatch.tariffHint;
      if (provMatch.bonusHint) bonusHint = provMatch.bonusHint;
      consumedIndices.add(i);
      continue;
    }
  }

  if (!detectedProvider) {
    return null;
  }

  // Remaining unconsumed lines:
  // Typically:
  // - First unconsumed line (at index 0 or 1): Customer Name ("Ghrery, Reda", "Hiba Shahien", "Kador, Youssef", "Alnahar, Mohammad", "Mahmoud Abdulaziz", "Azad Sidqi Saeed Saaed")
  // - Middle unconsumed line(s): Tariff / Product ("DSL100 + Router 4,99", "Familienversicherung")
  // - Last unconsumed line (at end of message): Tippgeber / VB ("Mosab GO", "Mazen H", "Siham H", "Aboud", "Telenergie")
  const remaining = lines
    .map((text, idx) => ({ text, idx }))
    .filter((item) => !consumedIndices.has(item.idx));

  let customerName: string | null = null;
  let tippgeber: string | null = null;
  const tariffParts: string[] = [];

  if (remaining.length >= 1) {
    customerName = remaining[0].text.replace(/\s+/g, " ").trim();
  }

  if (remaining.length >= 2) {
    // The last remaining line is the Tippgeber / VB if it was near the bottom of the message
    const lastItem = remaining[remaining.length - 1];
    if (lastItem.idx === lines.length - 1 || remaining.length >= 2) {
      tippgeber = lastItem.text.replace(/\s+/g, " ").trim();
    }
    for (let j = 1; j < remaining.length - 1; j++) {
      tariffParts.push(remaining[j].text.replace(/\*+/g, "").trim());
    }
  } else if (extra.vp) {
    // If only 1 remaining line (customerName), fallback tippgeber to VP
    tippgeber = String(extra.vp).replace(/^VP\s+/i, "").trim();
  }

  let tariff: string | null = null;
  if (tariffParts.length > 0 && providerTariffHint) {
    // Combine e.g. "Familienversicherung" + "BKK 400€"
    tariff = `${tariffParts.join(" - ")} (${providerTariffHint})`;
  } else if (tariffParts.length > 0) {
    tariff = tariffParts.join(" - ");
  } else if (providerTariffHint) {
    tariff = providerTariffHint;
  } else {
    tariff = detectedProvider;
  }

  if (bonusHint) {
    extra.bonus = bonusHint;
    if (detectedProvider === "BKK" && !extra.mitglied) {
      extra.mitglied = `mit ${bonusHint} Bonus`;
    }
  }

  if (!extra.vp && tippgeber) {
    extra.vp = tippgeber;
  }

  const finalDate =
    recordDate ||
    (fallbackDateIso ? fallbackDateIso.slice(0, 10) : new Date().toISOString().slice(0, 10));

  return {
    isSeparator: false,
    provider: detectedProvider,
    lines: [
      {
        provider: detectedProvider,
        customer_name: customerName,
        tariff,
        tippgeber,
        provision: null,
        record_date: finalDate,
        extra,
      },
    ],
  };
}
