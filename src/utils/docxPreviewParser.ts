import PizZip from 'pizzip';
import {
  BerkasRecord,
  CustomTemplateEntry,
  OfficeSettings,
  TemplateDocKey,
} from '../types/ppats';
import { renderSingleDocxBytes } from './bundleGenerator';
import { isAktaService } from './taxAndAudit';

export interface PreviewTextRun {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  sizePt?: number;
}

export interface PreviewImageEntry {
  dataUrl: string;
  widthPx?: number;
  heightPx?: number;
}

export interface PreviewParagraphBlock {
  kind: 'paragraph';
  runs: PreviewTextRun[];
  images?: PreviewImageEntry[];
  dashLeader?: 'trailing' | 'center-flanked';
  dashBold?: boolean;
  keyValueLabelRuns?: PreviewTextRun[];
  keyValueTabPx?: number;
  align: 'left' | 'center' | 'right' | 'justify';
  indentLeftPx: number;
  firstLinePx: number;
  hangingPx: number;
  borderBottom: boolean;
  spaceBeforePx: number;
  spaceAfterPx: number;
}

export interface PreviewTableCell {
  blocks: PreviewBlock[];
  widthPct?: number;
  verticalAlign?: 'top' | 'center' | 'bottom';
  rowSpan: number;
  hidden: boolean;
  borders: {
    top: boolean;
    bottom: boolean;
    left: boolean;
    right: boolean;
  };
}

export interface PreviewTableRow {
  cells: PreviewTableCell[];
}

export interface PreviewTableBlock {
  kind: 'table';
  widthPct: number;
  indentLeftPx: number;
  rows: PreviewTableRow[];
}

export type PreviewBlock = PreviewParagraphBlock | PreviewTableBlock;

export interface DocxPreviewPage {
  pageNumber: number;
  title: string;
  blocks: PreviewBlock[];
}

export interface DocxPreviewVerificationSummary {
  ketPihak1Label: string;
  ketPihak1Names: string;
  ketPihak2Label: string;
  ketPihak2Names: string;
  penerimaNama: string;
  pemilikAwalNama: string;
  dataPribadiSignersCount: number;
  leftoverTags: string[];
}

export interface DocxPreviewDocument {
  docKey: TemplateDocKey;
  fileName: string;
  paperSize: 'A4' | 'F4';
  usedCustomTemplate: boolean;
  pages: DocxPreviewPage[];
  footerLines: string[];
  summary: DocxPreviewVerificationSummary;
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function getAttr(tagOpen: string, attrName: string): string | undefined {
  const escaped = attrName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`(?:^|\\s)${escaped}\\s*=\\s*"([^"]*)"`, 'i').exec(tagOpen);
  if (m) return decodeXmlEntities(m[1]);
  const m2 = new RegExp(`(?:^|\\s)${escaped}\\s*=\\s*'([^']*)'`, 'i').exec(tagOpen);
  return m2 ? decodeXmlEntities(m2[1]) : undefined;
}

/**
 * Find direct child elements matching specific tag names inside an XML body slice.
 */
function extractElements(xml: string, targetTags: string[]): Array<{ tag: string; open: string; inner: string }> {
  const results: Array<{ tag: string; open: string; inner: string }> = [];
  const tagSet = new Set(targetTags);
  let pos = 0;

  while (pos < xml.length) {
    const lt = xml.indexOf('<', pos);
    if (lt === -1) break;

    if (xml.startsWith('<!--', lt)) {
      const endComment = xml.indexOf('-->', lt + 4);
      pos = endComment === -1 ? xml.length : endComment + 3;
      continue;
    }
    if (xml.startsWith('<?', lt) || xml.startsWith('<!', lt)) {
      const gt = xml.indexOf('>', lt + 2);
      pos = gt === -1 ? xml.length : gt + 1;
      continue;
    }
    if (xml[lt + 1] === '/') {
      const gt = xml.indexOf('>', lt + 2);
      pos = gt === -1 ? xml.length : gt + 1;
      continue;
    }

    const gt = xml.indexOf('>', lt + 1);
    if (gt === -1) break;

    const rawTag = xml.slice(lt + 1, gt);
    const selfClosing = rawTag.endsWith('/');
    const nameMatch = /^([^\s/>]+)/.exec(rawTag);
    const tagName = nameMatch?.[1] ?? '';

    if (selfClosing) {
      if (tagSet.has(tagName)) {
        results.push({ tag: tagName, open: `<${rawTag}>`, inner: '' });
      }
      pos = gt + 1;
      continue;
    }

    if (!tagSet.has(tagName)) {
      pos = gt + 1;
      continue;
    }

    // Walk balanced open/close tags for `tagName`
    let depth = 1;
    let scan = gt + 1;
    const openPrefix = `<${tagName}`;
    const closeTag = `</${tagName}>`;

    while (depth > 0 && scan < xml.length) {
      const nextOpen = xml.indexOf(openPrefix, scan);
      const nextClose = xml.indexOf(closeTag, scan);
      if (nextClose === -1) {
        scan = xml.length;
        break;
      }
      if (nextOpen !== -1 && nextOpen < nextClose) {
        const charAfter = xml[nextOpen + openPrefix.length];
        if (charAfter === '>' || charAfter === ' ' || charAfter === '\t' || charAfter === '\n' || charAfter === '/') {
          const openGt = xml.indexOf('>', nextOpen);
          if (openGt !== -1) {
            const isSelf = xml[openGt - 1] === '/';
            if (!isSelf) depth += 1;
            scan = openGt + 1;
            continue;
          }
        }
        scan = nextOpen + openPrefix.length;
      } else {
        depth -= 1;
        if (depth === 0) {
          if (tagSet.has(tagName)) {
            results.push({
              tag: tagName,
              open: `<${rawTag}>`,
              inner: xml.slice(gt + 1, nextClose),
            });
          }
          scan = nextClose + closeTag.length;
          break;
        }
        scan = nextClose + closeTag.length;
      }
    }

    pos = scan;
  }

  return results;
}

function twipsToPx(raw?: string): number {
  if (!raw) return 0;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n / 20) * 1.15);
}

function parseBoolTag(prXml: string, tag: string): boolean {
  const matches = extractElements(prXml, [tag]);
  if (matches.length === 0) return false;
  const val = getAttr(matches[0].open, 'w:val');
  if (val === '0' || val === 'false' || val === 'none' || val === 'nil') return false;
  return true;
}

interface ParsedParagraphChunk {
  hasPageBreakBefore: boolean;
  hasInlinePageBreak: boolean;
  paragraph: PreviewParagraphBlock;
}

function extractDocxImageMap(zip: PizZip): Map<string, string> {
  const map = new Map<string, string>();
  const relsXml = zip.file('word/_rels/document.xml.rels')?.asText() ?? '';
  if (!relsXml) return map;

  const relRegex = /<Relationship\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = relRegex.exec(relsXml)) !== null) {
    const tag = match[0];
    const id = getAttr(tag, 'Id');
    const target = getAttr(tag, 'Target');
    if (!id || !target || !target.includes('media/')) continue;
    const normalizedPath = target.startsWith('word/')
      ? target
      : `word/${target.replace(/^\/+/, '')}`;
    const entry = zip.file(normalizedPath);
    if (!entry) continue;
    const ext = normalizedPath.split('.').pop()?.toLowerCase() ?? 'png';
    const mime =
      ext === 'jpg' || ext === 'jpeg'
        ? 'image/jpeg'
        : ext === 'gif'
        ? 'image/gif'
        : ext === 'bmp'
        ? 'image/bmp'
        : 'image/png';
    try {
      const bytes = entry.asUint8Array();
      let base64 = '';
      if (typeof Buffer !== 'undefined') {
        base64 = Buffer.from(bytes).toString('base64');
      } else {
        let bin = '';
        for (let i = 0; i < bytes.length; i += 1) {
          bin += String.fromCharCode(bytes[i]);
        }
        base64 = btoa(bin);
      }
      map.set(id, `data:${mime};base64,${base64}`);
    } catch {
      // Ignore unreadable media entry
    }
  }
  return map;
}

function parseParagraphXml(
  innerXml: string,
  imageMap?: Map<string, string>
): ParsedParagraphChunk {
  const pPrList = extractElements(innerXml, ['w:pPr']);
  const pPr = pPrList[0]?.inner ?? '';

  const hasPageBreakBefore = parseBoolTag(pPr, 'w:pageBreakBefore');

  const jcMatches = extractElements(pPr, ['w:jc']);
  const jcVal = jcMatches[0] ? getAttr(jcMatches[0].open, 'w:val') : undefined;
  const align: PreviewParagraphBlock['align'] =
    jcVal === 'center'
      ? 'center'
      : jcVal === 'right'
      ? 'right'
      : jcVal === 'both' || jcVal === 'distribute'
      ? 'justify'
      : 'left';

  const indMatches = extractElements(pPr, ['w:ind']);
  const indentLeftRaw = indMatches[0] ? getAttr(indMatches[0].open, 'w:left') : undefined;
  const indentLeftTwips = indentLeftRaw ? Number(indentLeftRaw) || 0 : 0;
  const indentLeftPx = twipsToPx(indentLeftRaw);
  const firstLinePx = indMatches[0] ? twipsToPx(getAttr(indMatches[0].open, 'w:firstLine')) : 0;
  const hangingPx = indMatches[0] ? twipsToPx(getAttr(indMatches[0].open, 'w:hanging')) : 0;

  const tabsWrapper = extractElements(pPr, ['w:tabs'])[0];
  const tabDefs = tabsWrapper ? extractElements(tabsWrapper.inner, ['w:tab']) : [];
  let hasCenterHyphen = false;
  let hasRightHyphen = false;
  let leftTabPosTwips = 0;
  for (const td of tabDefs) {
    const val = getAttr(td.open, 'w:val');
    const leader = getAttr(td.open, 'w:leader');
    const pos = Number(getAttr(td.open, 'w:pos') ?? 0);
    if (val === 'center' && leader === 'hyphen') hasCenterHyphen = true;
    if (val === 'right' && leader === 'hyphen') hasRightHyphen = true;
    if (val === 'left' && Number.isFinite(pos) && pos > 0) leftTabPosTwips = pos;
  }

  const spacingMatches = extractElements(pPr, ['w:spacing']);
  const spaceBeforePx = spacingMatches[0]
    ? Math.min(72, Math.max(0, Math.round(twipsToPx(getAttr(spacingMatches[0].open, 'w:before')) * 0.65)))
    : 0;
  const spaceAfterPx = spacingMatches[0]
    ? Math.min(76, Math.max(0, Math.round(twipsToPx(getAttr(spacingMatches[0].open, 'w:after')) * 0.65)))
    : 2;

  const pBdrMatches = extractElements(pPr, ['w:pBdr']);
  let borderBottom = false;
  if (pBdrMatches[0]) {
    const bot = extractElements(pBdrMatches[0].inner, ['w:bottom']);
    if (bot[0]) {
      const v = getAttr(bot[0].open, 'w:val');
      borderBottom = v !== 'none' && v !== 'nil';
    }
  }

  let hasInlinePageBreak = false;
  type ParsedToken =
    | { kind: 'text'; run: PreviewTextRun }
    | { kind: 'tab'; bold: boolean; italic: boolean; underline: boolean; sizePt?: number };
  const tokens: ParsedToken[] = [];
  const images: PreviewImageEntry[] = [];
  const runElements = extractElements(innerXml, ['w:r']);

  for (const r of runElements) {
    const rPrMatches = extractElements(r.inner, ['w:rPr']);
    const rPr = rPrMatches[0]?.inner ?? '';
    const bold = parseBoolTag(rPr, 'w:b');
    const italic = parseBoolTag(rPr, 'w:i');
    const underline = parseBoolTag(rPr, 'w:u');
    const szMatches = extractElements(rPr, ['w:sz']);
    const szRaw = szMatches[0] ? Number(getAttr(szMatches[0].open, 'w:val')) : NaN;
    const sizePt = Number.isFinite(szRaw) && szRaw > 0 ? szRaw / 2 : undefined;

    if (imageMap && imageMap.size > 0 && r.inner.includes('blip')) {
      const blipMatch = /<a:blip\b[^>]*r:embed="([^"]+)"/i.exec(r.inner);
      if (blipMatch) {
        const dataUrl = imageMap.get(blipMatch[1]);
        if (dataUrl) {
          const extMatch = /<wp:extent\b[^>]*cx="(\d+)"[^>]*cy="(\d+)"/i.exec(r.inner);
          const widthPx = extMatch ? Math.round(Number(extMatch[1]) / 9525) : undefined;
          const heightPx = extMatch ? Math.round(Number(extMatch[2]) / 9525) : undefined;
          images.push({ dataUrl, widthPx, heightPx });
        }
      }
    }

    // Walk text, br, tab nodes inside run
    const parts = extractElements(r.inner, ['w:t', 'w:br', 'w:tab']);
    let textBuf = '';
    const flushText = () => {
      if (textBuf.length > 0) {
        tokens.push({
          kind: 'text',
          run: { text: textBuf, bold, italic, underline, sizePt },
        });
        textBuf = '';
      }
    };
    for (const part of parts) {
      if (part.tag === 'w:t') {
        textBuf += decodeXmlEntities(part.inner);
      } else if (part.tag === 'w:tab') {
        flushText();
        tokens.push({ kind: 'tab', bold, italic, underline, sizePt });
      } else if (part.tag === 'w:br') {
        const brType = getAttr(part.open, 'w:type');
        if (brType === 'page') {
          hasInlinePageBreak = true;
        } else {
          textBuf += '\n';
        }
      }
    }
    flushText();
  }

  let dashLeader: PreviewParagraphBlock['dashLeader'];
  let dashBold: boolean | undefined;
  let keyValueLabelRuns: PreviewTextRun[] | undefined;
  let keyValueTabPx: number | undefined;
  let workingTokens = tokens;

  const firstTok = workingTokens[0];
  const lastTok = workingTokens[workingTokens.length - 1];

  if (
    hasCenterHyphen &&
    hasRightHyphen &&
    workingTokens.length >= 3 &&
    firstTok?.kind === 'tab' &&
    lastTok?.kind === 'tab'
  ) {
    dashLeader = 'center-flanked';
    dashBold = firstTok.bold;
    workingTokens = workingTokens.slice(1, -1);
  } else if (hasRightHyphen && workingTokens.length >= 2 && lastTok?.kind === 'tab') {
    dashLeader = 'trailing';
    workingTokens = workingTokens.slice(0, -1);
    if (leftTabPosTwips > 0) {
      const internalTabIdx = workingTokens.findIndex((t) => t.kind === 'tab');
      if (internalTabIdx > 0) {
        keyValueLabelRuns = workingTokens
          .slice(0, internalTabIdx)
          .filter((t): t is Extract<ParsedToken, { kind: 'text' }> => t.kind === 'text')
          .map((t) => t.run);
        keyValueTabPx = Math.max(76, twipsToPx(String(Math.max(0, leftTabPosTwips - indentLeftTwips))));
        workingTokens = workingTokens.slice(internalTabIdx + 1);
      }
    }
  }

  const runs: PreviewTextRun[] = [];
  for (const tok of workingTokens) {
    if (tok.kind === 'text') {
      runs.push(tok.run);
    } else {
      runs.push({
        text: '    ',
        bold: tok.bold,
        italic: tok.italic,
        underline: tok.underline,
        sizePt: tok.sizePt,
      });
    }
  }

  if (dashLeader === 'center-flanked' && runs.length > 0) {
    // Trim leading/trailing padding spaces around centered heading so flex gap controls spacing symmetrically
    runs[0] = { ...runs[0], text: runs[0].text.replace(/^\s+/, '') };
    const lastIdx = runs.length - 1;
    runs[lastIdx] = { ...runs[lastIdx], text: runs[lastIdx].text.replace(/\s+$/, '') };
  }

  return {
    hasPageBreakBefore,
    hasInlinePageBreak,
    paragraph: {
      kind: 'paragraph',
      runs,
      ...(images.length > 0 ? { images } : {}),
      ...(dashLeader ? { dashLeader } : {}),
      ...(dashBold !== undefined ? { dashBold } : {}),
      ...(keyValueLabelRuns && keyValueLabelRuns.length > 0
        ? { keyValueLabelRuns, keyValueTabPx }
        : {}),
      align,
      indentLeftPx,
      firstLinePx,
      hangingPx,
      borderBottom,
      spaceBeforePx,
      spaceAfterPx,
    },
  };
}

function parsePercentageWidth(raw?: string, type?: string): number | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (trimmed.endsWith('%')) {
    const n = parseFloat(trimmed);
    return Number.isFinite(n) ? n : undefined;
  }
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num <= 0) return undefined;
  if (type === 'pct') {
    return num > 100 ? Math.round((num / 50) * 10) / 10 : num;
  }
  return undefined;
}

function parseDxaWidth(raw?: string, type?: string): number | undefined {
  if (!raw) return undefined;
  if (type && type !== 'dxa') return undefined;
  const num = Number(raw.trim());
  return Number.isFinite(num) && num > 0 ? num : undefined;
}

function hasVisibleBorder(borderXml: string, side: string): boolean | undefined {
  const m = extractElements(borderXml, [side]);
  if (m.length === 0) return undefined;
  const v = getAttr(m[0].open, 'w:val');
  return v !== 'none' && v !== 'nil';
}

function parseTableXml(
  innerXml: string,
  imageMap?: Map<string, string>,
  parentWidthDxa = 9310
): PreviewTableBlock {
  const tblPr = extractElements(innerXml, ['w:tblPr'])[0]?.inner ?? '';
  const tblW = extractElements(tblPr, ['w:tblW'])[0];
  const tblWVal = tblW ? getAttr(tblW.open, 'w:w') : undefined;
  const tblWType = tblW ? getAttr(tblW.open, 'w:type') : undefined;
  const tblInd = extractElements(tblPr, ['w:tblInd'])[0];
  const indentTwips = tblInd ? Number(getAttr(tblInd.open, 'w:w') ?? 0) : 0;
  const indentLeftPx = tblInd ? twipsToPx(getAttr(tblInd.open, 'w:w')) : 0;

  const tblGrid = extractElements(innerXml, ['w:tblGrid'])[0]?.inner ?? '';
  const gridColWidths = extractElements(tblGrid, ['w:gridCol'])
    .map((col) => Number(getAttr(col.open, 'w:w') ?? 0))
    .filter((n) => Number.isFinite(n) && n > 0);
  const gridTotalDxa = gridColWidths.reduce((sum, w) => sum + w, 0);

  const tblDxa = parseDxaWidth(tblWVal, tblWType) ?? (gridTotalDxa > 0 ? gridTotalDxa : undefined);
  let widthPct = tblW ? parsePercentageWidth(tblWVal, tblWType) : undefined;
  if (widthPct === undefined) {
    if (tblDxa) {
      const printableDxa = Math.max(
        1800,
        parentWidthDxa - (Number.isFinite(indentTwips) ? indentTwips : 0)
      );
      widthPct =
        tblDxa >= printableDxa * 0.9
          ? 100
          : Math.min(100, Math.round((tblDxa / printableDxa) * 100));
    } else {
      widthPct = 100;
    }
  }

  const tblBorders = extractElements(tblPr, ['w:tblBorders'])[0]?.inner ?? '';
  const defaultBorders = {
    top: hasVisibleBorder(tblBorders, 'w:top') ?? false,
    bottom: hasVisibleBorder(tblBorders, 'w:bottom') ?? false,
    left: hasVisibleBorder(tblBorders, 'w:left') ?? false,
    right: hasVisibleBorder(tblBorders, 'w:right') ?? false,
  };

  const trElements = extractElements(innerXml, ['w:tr']);
  const rowsMeta: Array<{
    cells: Array<PreviewTableCell & { _vMerge: 'restart' | 'continue' | null }>;
  }> = [];

  for (const tr of trElements) {
    const tcElements = extractElements(tr.inner, ['w:tc']);
    const rawCellDxa: Array<number | undefined> = [];
    const cells: Array<PreviewTableCell & { _vMerge: 'restart' | 'continue' | null }> = [];
    for (let cIdx = 0; cIdx < tcElements.length; cIdx++) {
      const tc = tcElements[cIdx];
      const tcPr = extractElements(tc.inner, ['w:tcPr'])[0]?.inner ?? '';
      const tcW = extractElements(tcPr, ['w:tcW'])[0];
      const tcWVal = tcW ? getAttr(tcW.open, 'w:w') : undefined;
      const tcWType = tcW ? getAttr(tcW.open, 'w:type') : undefined;
      const cellWidthPct = tcW ? parsePercentageWidth(tcWVal, tcWType) : undefined;
      const cellDxa = tcW ? parseDxaWidth(tcWVal, tcWType) : gridColWidths[cIdx];
      rawCellDxa.push(cellDxa);

      const vMergeEl = extractElements(tcPr, ['w:vMerge'])[0];
      let vMerge: 'restart' | 'continue' | null = null;
      if (vMergeEl) {
        const val = getAttr(vMergeEl.open, 'w:val');
        vMerge = val === 'restart' ? 'restart' : 'continue';
      }

      const vAlignEl = extractElements(tcPr, ['w:vAlign'])[0];
      const vAlignVal = vAlignEl ? getAttr(vAlignEl.open, 'w:val') : undefined;
      const verticalAlign: PreviewTableCell['verticalAlign'] =
        vAlignVal === 'bottom' ? 'bottom' : vAlignVal === 'center' ? 'center' : 'top';

      const tcBorders = extractElements(tcPr, ['w:tcBorders'])[0]?.inner ?? '';
      const borders = {
        top: hasVisibleBorder(tcBorders, 'w:top') ?? defaultBorders.top,
        bottom: hasVisibleBorder(tcBorders, 'w:bottom') ?? defaultBorders.bottom,
        left: hasVisibleBorder(tcBorders, 'w:left') ?? defaultBorders.left,
        right: hasVisibleBorder(tcBorders, 'w:right') ?? defaultBorders.right,
      };

      const children = extractElements(tc.inner, ['w:p', 'w:tbl']);
      const blocks: PreviewBlock[] = [];
      const childParentDxa = cellDxa && cellDxa > 0 ? cellDxa : parentWidthDxa;
      for (const ch of children) {
        if (ch.tag === 'w:p') {
          const parsedP = parseParagraphXml(ch.inner, imageMap);
          blocks.push(parsedP.paragraph);
        } else if (ch.tag === 'w:tbl') {
          blocks.push(parseTableXml(ch.inner, imageMap, childParentDxa));
        }
      }

      cells.push({
        blocks,
        widthPct: cellWidthPct,
        verticalAlign,
        rowSpan: 1,
        hidden: false,
        borders,
        _vMerge: vMerge,
      });
    }

    // Resolve DXA cell widths to accurate percentages when pct was not explicitly specified
    const rowDxaTotal =
      rawCellDxa.every((v) => typeof v === 'number' && v > 0)
        ? rawCellDxa.reduce<number>((sum, v) => sum + (v ?? 0), 0)
        : gridTotalDxa > 0
        ? gridTotalDxa
        : tblDxa ?? 0;

    if (rowDxaTotal > 0) {
      for (let cIdx = 0; cIdx < cells.length; cIdx++) {
        if (cells[cIdx].widthPct === undefined) {
          const dxa = rawCellDxa[cIdx] ?? gridColWidths[cIdx];
          if (dxa && dxa > 0) {
            cells[cIdx].widthPct = Math.round((dxa / rowDxaTotal) * 1000) / 10;
          }
        }
      }
    }

    rowsMeta.push({ cells });
  }

  // Resolve vertical merges (rowSpan) across rows by column index
  for (let r = 0; r < rowsMeta.length; r++) {
    const row = rowsMeta[r];
    for (let c = 0; c < row.cells.length; c++) {
      const cell = row.cells[c];
      if (cell._vMerge === 'restart') {
        let span = 1;
        for (let r2 = r + 1; r2 < rowsMeta.length; r2++) {
          const below = rowsMeta[r2].cells[c];
          if (!below || below._vMerge !== 'continue') break;
          below.hidden = true;
          // Inherit bottom border from the final merged cell so bottom outline completes cleanly
          cell.borders.bottom = cell.borders.bottom || below.borders.bottom;
          span += 1;
        }
        cell.rowSpan = span;
      } else if (cell._vMerge === 'continue' && !cell.hidden) {
        // Fallback if continue appeared without restart
        cell.rowSpan = 1;
      }
    }
  }

  return {
    kind: 'table',
    widthPct,
    indentLeftPx,
    rows: rowsMeta.map((row) => ({
      cells: row.cells.map(({ _vMerge: _ignored, ...rest }) => rest),
    })),
  };
}

function collectBlockText(block: PreviewBlock): string {
  if (block.kind === 'paragraph') {
    return block.runs.map((r) => r.text).join('');
  }
  return block.rows
    .map((r) =>
      r.cells
        .filter((c) => !c.hidden)
        .map((c) => c.blocks.map(collectBlockText).join(' '))
        .join(' ')
    )
    .join('\n');
}

function detectPageTitle(docKey: TemplateDocKey, blocks: PreviewBlock[], pageNum: number): string {
  const joined = blocks.map(collectBlockText).join('\n');
  if (docKey === '01_akta') {
    if (pageNum === 1) return 'Hal. 1 · Naskah Akta PPATS';
    if (joined.includes('Pejabat Pembuat Akta Tanah Sementara')) {
      return `Hal. ${pageNum} · Halaman Tanda Tangan`;
    }
    return `Hal. ${pageNum} · Lanjutan Akta`;
  }

  if (joined.includes('SURAT PERNYATAAN AHLI WARISAN')) return `Hal. ${pageNum} · Surat Pernyataan Ahli Warisan`;
  if (joined.includes('SURAT PERNYATAAN PEMBAGIAN WARISAN')) return `Hal. ${pageNum} · Surat Pernyataan Pembagian Warisan`;
  if (joined.includes('SURAT KETERANGAN RIWAYAT TANAH')) return `Hal. ${pageNum} · Surat Keterangan Riwayat Tanah`;
  if (joined.includes('PP No. 24/1997') || joined.includes('Gambar Situasi tanah')) {
    return `Hal. ${pageNum} · Surat Keterangan Desa (PP 24/1997)`;
  }
  if (joined.includes('BERITA ACARA KESAKSIAN')) {
    if (joined.includes('Landreform') || joined.includes('belum mempunyai sertipikat')) {
      return `Hal. ${pageNum} · Berita Acara Kesaksian (Riwayat)`;
    }
    return `Hal. ${pageNum} · Berita Acara Kesaksian (Fisik)`;
  }
  if (joined.includes('SURAT KETERANGAN WARISAN')) return `Hal. ${pageNum} · Surat Keterangan Warisan (SKW)`;
  if (joined.includes('Dokumen yang diserahkan')) return `Hal. ${pageNum} · Surat Pengantar ATR/BPN`;
  if (
    joined.includes('Permohonan Persetujuan Kesesuaian Kegiatan Pemanfaatan Ruang') &&
    joined.includes('DPMPTSP') === false &&
    joined.includes('Dinas Penanaman Modal')
  ) {
    return `Hal. ${pageNum} · Permohonan PKKPR (DPMPTSP)`;
  }
  if (joined.includes('Permohonan Layanan Peta Analisis Penatagunaan Tanah') && joined.includes('KETERANGAN TENTANG TANAH YANG DIMOHON')) {
    return `Hal. ${pageNum} · Permohonan Peta Analisis`;
  }
  if (joined.includes('SKET RENCANA PEMECAHAN BIDANG TANAH')) {
    return `Hal. ${pageNum} · Sket Rencana Pemecahan`;
  }
  if (joined.includes('SURAT PERNYATAAN ALASAN PEMECAHAN')) {
    return `Hal. ${pageNum} · Pernyataan Alasan Pemecahan`;
  }
  if (joined.includes('GEOTAGGING') && joined.includes('ANALISIS BIDANG')) {
    return `Hal. ${pageNum} · Geotagging & Analisis Bidang`;
  }
  if (joined.includes('bekas Hak Milik Adat') && joined.includes('Tampak Depan')) {
    return `Hal. ${pageNum} · Geotagging Tampak Depan & Patok 1-2`;
  }
  if (joined.includes('Poligon') && (joined.includes('Patok 3') || joined.includes('3') && joined.includes('4'))) {
    return `Hal. ${pageNum} · Patok 3-4 & Poligon`;
  }
  if (joined.includes('GEOTAGGING')) return `Hal. ${pageNum} · Geotagging (Tampak Depan & Patok)`;
  if (joined.includes('CITRA SATELIT / POLIGON')) {
    return `Hal. ${pageNum} · Geotagging Lanjutan (Patok 3-4 & Poligon)`;
  }
  if (joined.includes('KEABSAHAN DATA & LOKASI BIDANG')) {
    return `Hal. ${pageNum} · Pernyataan Keabsahan & Lokasi Bidang`;
  }
  if (
    joined.includes('Dengan ini mengajukan permohonan') ||
    joined.includes('Kantor Kementrian Agraria') ||
    joined.includes('Kantor Kementerian Agraria')
  ) {
    return `Hal. ${pageNum} · Permohonan ATR/BPN`;
  }
  if (joined.includes('SURAT KUASA')) {
    if (joined.includes('Pemecahan bidang Sertipikat')) {
      return `Hal. ${pageNum} · Surat Kuasa (Pemecahan Bidang)`;
    }
    if (joined.includes('pengakuan Hak Sertipikat')) {
      return `Hal. ${pageNum} · Surat Kuasa (Pengakuan Hak)`;
    }
    return `Hal. ${pageNum} · Surat Kuasa`;
  }
  if (joined.includes('PENGUASAAN FISIK BIDANG TANAH')) return `Hal. ${pageNum} · Penguasaan Fisik Bidang Tanah`;
  if (joined.includes('PENGUASAAN FISIK TANAH')) return `Hal. ${pageNum} · Penguasaan Fisik & Tidak Sengketa`;
  if (joined.includes('PEMASANGAN TANDA BATAS')) return `Hal. ${pageNum} · Pemasangan Tanda Batas & Sketsa`;
  if (joined.includes('GAMBAR SKET TANAH')) return `Hal. ${pageNum} · Gambar Sket Tanah`;
  if (joined.includes('PELEPASAN JALAN')) return `Hal. ${pageNum} · Pelepasan Jalan`;
  if (joined.includes('BEDA NAMA')) return `Hal. ${pageNum} · Surat Pernyataan Beda Nama`;
  if (joined.includes('KRONOLOGI RALAT DATA')) return `Hal. ${pageNum} · Kronologi Ralat Data`;
  if (joined.includes('TIDAK MENUNTUT PENGEMBALIAN PNBP')) return `Hal. ${pageNum} · Penutupan Permohonan & PNBP`;
  if (joined.includes('FOTO LOKASI')) return `Hal. ${pageNum} · Foto Lokasi Tampak Depan & Patok 1-2`;
  if (joined.includes('POLIGON') && (joined.includes('3') || joined.includes('4'))) {
    return `Hal. ${pageNum} · Patok 3-4 & Poligon`;
  }
  if (joined.includes('kekurangan pembayaran BPHTB')) return `Hal. ${pageNum} · Surat Pernyataan BPHTB`;
  if (joined.includes('SPPT/PBB')) return `Hal. ${pageNum} · Surat Pernyataan SPPT/PBB`;
  if (joined.includes('PERTANGGUNGJAWABAN KEABSAHAN')) return `Hal. ${pageNum} · Keabsahan & Kebenaran Dokumen`;
  if (joined.includes('PEMROSESAN DATA PRIBADI')) return `Hal. ${pageNum} · Persetujuan Pemrosesan Data Pribadi`;
  if (joined.includes('SURAT PERNYATAAN')) return `Hal. ${pageNum} · Surat Pernyataan`;
  return `Hal. ${pageNum}`;
}

function isEmptyParagraphBlock(block: PreviewBlock): boolean {
  if (block.kind !== 'paragraph') return false;
  if (block.images && block.images.length > 0) return false;
  return block.runs.every((r) => r.text.trim() === '');
}

export function parseDocxBytesToPreview(
  bytes: Uint8Array,
  meta: {
    docKey: TemplateDocKey;
    fileName: string;
    paperSize: 'A4' | 'F4';
    usedCustomTemplate: boolean;
    context: Record<string, unknown>;
  }
): DocxPreviewDocument {
  const zip = new PizZip(bytes);
  const imageMap = extractDocxImageMap(zip);
  const docXml = zip.file('word/document.xml')?.asText() ?? '';
  const bodyInner = extractElements(docXml, ['w:body'])[0]?.inner ?? '';
  const topElements = extractElements(bodyInner, ['w:p', 'w:tbl']);

  const rawPages: PreviewBlock[][] = [[]];
  for (const el of topElements) {
    if (el.tag === 'w:p') {
      const parsed = parseParagraphXml(el.inner, imageMap);
      if (parsed.hasPageBreakBefore && rawPages[rawPages.length - 1].length > 0) {
        rawPages.push([]);
      }
      const hasContent =
        parsed.paragraph.runs.some((r) => r.text.length > 0) ||
        Boolean(parsed.paragraph.images && parsed.paragraph.images.length > 0);
      if (hasContent || !parsed.hasInlinePageBreak) {
        rawPages[rawPages.length - 1].push(parsed.paragraph);
      }
      if (parsed.hasInlinePageBreak) {
        rawPages.push([]);
      }
    } else if (el.tag === 'w:tbl') {
      rawPages[rawPages.length - 1].push(parseTableXml(el.inner, imageMap));
    }
  }

  // Compact excessive consecutive blank paragraphs (e.g. from Docxtemplater conditional blocks)
  const pages: DocxPreviewPage[] = rawPages
    .map((blocks) => {
      const cleaned: PreviewBlock[] = [];
      let blankStreak = 0;
      for (const b of blocks) {
        if (isEmptyParagraphBlock(b)) {
          blankStreak += 1;
          if (blankStreak <= 1 && cleaned.length > 0) {
            cleaned.push(b);
          }
        } else {
          blankStreak = 0;
          cleaned.push(b);
        }
      }
      while (cleaned.length > 0 && isEmptyParagraphBlock(cleaned[cleaned.length - 1])) {
        cleaned.pop();
      }
      return cleaned;
    })
    .filter((blocks) => blocks.length > 0)
    .map((blocks, idx) => ({
      pageNumber: idx + 1,
      title: detectPageTitle(meta.docKey, blocks, idx + 1),
      blocks,
    }));

  // Parse footer lines if present (Akta A4 footer)
  const footerFiles = Object.keys(zip.files).filter((k) => k.startsWith('word/footer'));
  const footerLines: string[] = [];
  if (footerFiles.length > 0) {
    const fXml = zip.file(footerFiles[0])?.asText() ?? '';
    const fParas = extractElements(fXml, ['w:p']);
    for (const fp of fParas) {
      const parsed = parseParagraphXml(fp.inner);
      const txt = parsed.paragraph.runs
        .map((r) => r.text)
        .join('')
        .replace(/Halaman\s+dari\s+halaman/i, 'Halaman 1 dari ... halaman')
        .trim();
      if (txt) footerLines.push(txt);
    }
  }

  const allText = pages.map((p) => p.blocks.map(collectBlockText).join('\n')).join('\n');
  const leftoverTags = Array.from(new Set(allText.match(/\{\{[^}]+\}\}/g) ?? []));

  const signers = Array.isArray(meta.context.pihak_data_pribadi_ttd)
    ? meta.context.pihak_data_pribadi_ttd
    : [];

  return {
    docKey: meta.docKey,
    fileName: meta.fileName,
    paperSize: meta.paperSize,
    usedCustomTemplate: meta.usedCustomTemplate,
    pages,
    footerLines,
    summary: {
      ketPihak1Label: String(meta.context.ket_pihak1_label || 'Penjual'),
      ketPihak1Names: String(meta.context.ket_pihak1_names || '-').replace(/\n/g, ', '),
      ketPihak2Label: String(meta.context.ket_pihak2_label || 'Pembeli'),
      ketPihak2Names: String(meta.context.ket_pihak2_names || '-').replace(/\n/g, ', '),
      penerimaNama: String(meta.context.penerima_nama || '-'),
      pemilikAwalNama: String(meta.context.pemilik_awal_nama || '-'),
      dataPribadiSignersCount: signers.length,
      leftoverTags,
    },
  };
}

export async function renderDocxPreviewPages(
  record: BerkasRecord,
  settings: OfficeSettings,
  customTemplates: Partial<Record<TemplateDocKey, CustomTemplateEntry>>,
  docKey: TemplateDocKey
): Promise<DocxPreviewDocument> {
  const effectiveDocKey: TemplateDocKey = isAktaService(record.layanan)
    ? docKey
    : '02_lampiran_bundel';
  const { bytes, fileName, usedCustomTemplate, context } = await renderSingleDocxBytes(
    record,
    settings,
    customTemplates,
    effectiveDocKey
  );
  const paperSize: 'A4' | 'F4' =
    effectiveDocKey === '01_akta' && isAktaService(record.layanan) ? 'A4' : 'F4';
  return parseDocxBytesToPreview(bytes, {
    docKey: effectiveDocKey,
    fileName,
    paperSize,
    usedCustomTemplate,
    context,
  });
}
