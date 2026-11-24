/**
 * Pure layout & typography helpers shared across Lampiran Bundel Akta,
 * Non-Akta, and Waris C templates.
 */

/**
 * Returns true only when a party's "Pekerjaan" value is genuinely populated.
 * Blank strings, dashes ("-", "–", "—"), dots ("..."), or placeholders like
 * "tidak ada" / "kosong" return false so the Pekerjaan row is omitted cleanly.
 */
export function hasFilledPekerjaan(val?: string | null): boolean {
  const s = (val ?? '').trim();
  if (!s) return false;
  if (/^[-–—_.…\s]+$/.test(s)) return false;
  if (/^(tidak ada|kosong|null|undefined|n\/a)$/i.test(s)) return false;
  return true;
}

/**
 * Returns true if a KV table row label represents the Pekerjaan field.
 */
export function isPekerjaanLabel(label: string): boolean {
  return /^\s*(?:\d+\.\s*)?pekerjaan\s*$/i.test(label);
}

/**
 * Adaptive vertical spacing for numbered multi-party signature tables
 * (`1. NAMA | (.............)`).
 * Keeps comfortable signing space for 1–2 signers while tightening cleanly
 * when many signers appear (e.g. 6–12+ ahli waris / pemohon) to save paper
 * and avoid excessively wide gaps between signature rows.
 */
export function computeSignerRowSpacing(partyCount: number): {
  rowGapTwips: number;
  headerGapTwips: number;
  lineTwips: number;
} {
  if (partyCount <= 2) {
    return { rowGapTwips: 210, headerGapTwips: 130, lineTwips: 245 };
  }
  if (partyCount <= 4) {
    return { rowGapTwips: 120, headerGapTwips: 95, lineTwips: 235 };
  }
  if (partyCount <= 6) {
    return { rowGapTwips: 65, headerGapTwips: 70, lineTwips: 228 };
  }
  return { rowGapTwips: 35, headerGapTwips: 50, lineTwips: 222 };
}

/**
 * Compact checklist line spacing & paragraph spacing (Permohonan 1..14 & Lampiran 1..N)
 * to avoid wasting vertical space on F4 pages.
 */
export const COMPACT_CHECKLIST_LINE = 220;
export const COMPACT_PARTY_KV_LINE = 225;

/**
 * Printable vertical budget on a single F4 page (height 18709 - margins ~2160 = ~16549 twips),
 * leaving a conservative safety margin so Word never unexpectedly spills 1-2 lines onto a blank page.
 */
export const F4_SINGLE_PAGE_BUDGET_TWIPS = 15800;

/**
 * Estimated vertical height of a compact single-pejabat "Mengetahui," Pengesahan block
 * placed at the bottom of intermediate pages of a multi-page Surat Pernyataan.
 */
export const INTERMEDIATE_PENGESAHAN_HEIGHT_TWIPS = 2150;

export interface PartyHeightInput {
  pekerjaan?: string | null;
  alamat?: string | null;
}

/**
 * Estimates the vertical height (in twips) of one party's identity rows in a compact kvTable.
 */
export function estimateSinglePartyTwips(
  party: PartyHeightInput,
  isFirstInBlock: boolean
): number {
  const baseRows = hasFilledPekerjaan(party.pekerjaan) ? 5 : 4;
  const addrLen = (party.alamat ?? '').trim().length;
  const extraAddrLines = addrLen > 56 ? Math.ceil((addrLen - 56) / 56) : 0;
  const lines = baseRows + extraAddrLines;
  // Compact kv row (~245 twips per visual line) + inter-party gap (45 twips)
  return lines * 245 + (isFirstInBlock ? 0 : 45);
}

/**
 * Estimates the total vertical height (in twips) of a numbered signature block.
 */
export function estimateSignerBlockTwips(partyCount: number): number {
  if (partyCount <= 1) {
    return 2250; // date + label + meterai clearance + name
  }
  const spacing = computeSignerRowSpacing(partyCount);
  const perRow = Math.round(spacing.lineTwips * 1.05) + spacing.rowGapTwips;
  return 560 + spacing.headerGapTwips + partyCount * perRow;
}

export interface MultiPageStatementPlan {
  isMultiPage: boolean;
  /**
   * Number of parties placed on Page 1.
   * When `isMultiPage` is false, equals `parties.length`.
   * When `isMultiPage` is true and `putBodyOnPage1` is true, equals `parties.length`
   * (body fits on Page 1 alongside Page-1 Pengesahan, signatures move cleanly to Page 2).
   * When `isMultiPage` is true and `putBodyOnPage1` is false, Page 1 holds `page1PartyCount`
   * parties + Page-1 Pengesahan, and Page 2 holds the remaining parties (if any) + body + signatures.
   */
  page1PartyCount: number;
  putBodyOnPage1: boolean;
}

/**
 * Determines whether a Surat Pernyataan / Surat Kuasa / Keabsahan fits on 1 single F4 page
 * or requires clean multi-page pagination with an explicit Page-1 "Mengetahui," Pengesahan
 * block (in addition to the final Page-2 Pengesahan alongside signatures).
 */
export function planStatementPagination(opts: {
  parties: PartyHeightInput[];
  headerTwips: number;
  bodyTwips: number;
  signatureBlockTwips: number;
  pageBudgetTwips?: number;
}): MultiPageStatementPlan {
  const budget = opts.pageBudgetTwips ?? F4_SINGLE_PAGE_BUDGET_TWIPS;
  const totalParties = opts.parties.length;
  const partyHeights = opts.parties.map((p, idx) =>
    estimateSinglePartyTwips(p, idx === 0)
  );
  const allPartiesTwips = partyHeights.reduce((sum, h) => sum + h, 0);
  const totalTwips =
    opts.headerTwips + allPartiesTwips + opts.bodyTwips + opts.signatureBlockTwips;

  if (totalTwips <= budget) {
    return {
      isMultiPage: false,
      page1PartyCount: totalParties,
      putBodyOnPage1: true,
    };
  }

  // Needs 2+ pages — reserve bottom space on Page 1 for intermediate Pengesahan
  const page1ContentBudget = budget - INTERMEDIATE_PENGESAHAN_HEIGHT_TWIPS;

  // Case A: header + all parties + body fit on Page 1 along with Page-1 Pengesahan
  if (opts.headerTwips + allPartiesTwips + opts.bodyTwips <= page1ContentBudget) {
    return {
      isMultiPage: true,
      page1PartyCount: totalParties,
      putBodyOnPage1: true,
    };
  }

  // Case B: header + all parties fit on Page 1 (with Page-1 Pengesahan), body + signers on Page 2
  if (opts.headerTwips + allPartiesTwips <= page1ContentBudget) {
    return {
      isMultiPage: true,
      page1PartyCount: totalParties,
      putBodyOnPage1: false,
    };
  }

  // Case C: party list itself is long (e.g., 10–15+ parties) — fill Page 1 greedily
  let used = opts.headerTwips;
  let fitCount = 0;
  for (let i = 0; i < partyHeights.length; i += 1) {
    if (used + partyHeights[i] <= page1ContentBudget || fitCount === 0) {
      used += partyHeights[i];
      fitCount += 1;
    } else {
      break;
    }
  }
  return {
    isMultiPage: true,
    page1PartyCount: fitCount,
    putBodyOnPage1: false,
  };
}
