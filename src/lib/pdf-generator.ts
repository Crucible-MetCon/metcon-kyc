import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage, PDFImage } from 'pdf-lib';
import { Counterparty, AssociatedPerson, Document as PrismaDocument } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';

type CounterpartyFull = Counterparty & { associated_persons: AssociatedPerson[] };

// ─── Design tokens matching KYC DOC 011 visual style ──────────────────────────
const NAVY    = rgb(0.08, 0.12, 0.27);
const ORANGE  = rgb(0.74, 0.38, 0.12);
const DARK    = rgb(0.10, 0.10, 0.12);
const MID     = rgb(0.40, 0.42, 0.46);
const LIGHT   = rgb(0.62, 0.64, 0.68);
const BORDER  = rgb(0.76, 0.79, 0.83);
const LBL_BG  = rgb(0.960, 0.965, 0.972);
const GREEN   = rgb(0.06, 0.52, 0.32);
const RED     = rgb(0.80, 0.13, 0.08);
const FTR_BG  = rgb(0.10, 0.14, 0.26);
const WHITE   = rgb(1, 1, 1);
const RULE    = rgb(0.22, 0.36, 0.65);
const ROW_ALT = rgb(0.975, 0.977, 0.982);

const PW = 595.28;   // A4 width (points)
const PH = 841.89;   // A4 height (points)
const MG = 42;       // page margin
const CW = PW - MG * 2;   // content width: 511.28
const FH = 30;       // footer height
const LW = 200;      // label column width in 2-col rows
const VW = CW - LW;  // value column width: 311.28
const RH = 18;       // standard row height

// ─── Helpers ───────────────────────────────────────────────────────────────────

// pdf-lib standard fonts only support WinAnsi (Latin-1 + cp1252 0x80-0x9F).
// Sanitise text so no character outside that range reaches drawText().
function sanitize(s: string): string {
  return s
    .replace(/[\u2018\u2019]/g, "'")   // smart single quotes
    .replace(/[\u201C\u201D]/g, '"')   // smart double quotes
    .replace(/\u2026/g, '...')         // ellipsis
    .replace(/\u2022/g, '-')           // bullet
    .replace(/\u2192/g, '->')          // right arrow
    .replace(/\u2190/g, '<-')          // left arrow
    .replace(/\u00AE/g, '(R)')         // registered trademark
    .replace(/\u00A9/g, '(C)')         // copyright
    .replace(/[^\x20-\xFF]/g, '?');    // anything else outside Latin-1 → ?
}

function val(x: unknown): string {
  if (x === null || x === undefined) return '';
  if (typeof x === 'boolean') return x ? 'Yes' : 'No';
  return sanitize(String(x).trim());
}

function wrapText(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const lines: string[] = [];
  for (const seg of sanitize(text).split('\n')) {
    const words = seg.split(' ');
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) > maxW && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
  }
  return lines.length ? lines : [''];
}

// ─── Shared page context ───────────────────────────────────────────────────────
interface Ctx {
  doc: PDFDocument;
  pg: PDFPage;
  B: PDFFont;    // HelveticaBold
  R: PDFFont;    // Helvetica
  logo: PDFImage | null;
  y: number;
  n: number;     // page number
  caseId: string;
}

// ─── Footer ────────────────────────────────────────────────────────────────────
function drawFooter(c: Ctx): void {
  c.pg.drawRectangle({ x: 0, y: 0, width: PW, height: FH, color: FTR_BG });
  c.pg.drawText('Metal Concentrators SA (Pty) Ltd', {
    x: MG, y: FH - 10, font: c.B, size: 6.5, color: WHITE,
  });
  c.pg.drawText('T: +27 (0) 12 000 4440   E: info@metcon.co.za   W: MetCon.co.za', {
    x: MG, y: FH - 20, font: c.R, size: 5.8, color: rgb(0.65, 0.68, 0.78),
  });
  const pn = `PAGE ${c.n}`;
  c.pg.drawText(pn, {
    x: PW - MG - c.R.widthOfTextAtSize(pn, 6.5), y: FH - 10,
    font: c.R, size: 6.5, color: rgb(0.65, 0.68, 0.78),
  });
  const dr = 'KYC DOC 011 Customer & Supplier  |  Version 004_202511';
  c.pg.drawText(dr, {
    x: PW - MG - c.R.widthOfTextAtSize(dr, 5.8), y: FH - 20,
    font: c.R, size: 5.8, color: rgb(0.50, 0.53, 0.63),
  });
}

// ─── Standard page header (logo + title + rule) ────────────────────────────────
function drawPageHeader(c: Ctx): void {
  const top = PH - MG;
  if (c.logo) {
    c.pg.drawImage(c.logo, { x: MG, y: top - 28, width: 64, height: 28 });
  } else {
    c.pg.drawText('MC.', { x: MG, y: top - 14, font: c.B, size: 16, color: NAVY });
    c.pg.drawText('METAL CONCENTRATORS', { x: MG, y: top - 24, font: c.R, size: 5, color: MID });
  }
  const t1 = 'Know Your Counterparty';
  c.pg.drawText(t1, {
    x: PW - MG - c.B.widthOfTextAtSize(t1, 13), y: top - 12, font: c.B, size: 13, color: NAVY,
  });
  const t2 = 'Master data form for Customers and Suppliers';
  c.pg.drawText(t2, {
    x: PW - MG - c.R.widthOfTextAtSize(t2, 7.5), y: top - 23, font: c.R, size: 7.5, color: ORANGE,
  });
  const ly = top - 34;
  c.pg.drawLine({ start: { x: MG, y: ly }, end: { x: PW - MG, y: ly }, thickness: 0.6, color: BORDER });
  c.y = ly - 8;
  drawFooter(c);
}

// ─── Add a new page and draw its header ───────────────────────────────────────
function newPage(c: Ctx): void {
  c.n++;
  c.pg = c.doc.addPage([PW, PH]);
  c.y = PH - MG;
  drawPageHeader(c);
}

function ensureSpace(c: Ctx, need: number): void {
  if (c.y < MG + FH + need) newPage(c);
}

// ─── Two-column table row (label | value) ──────────────────────────────────────
function tRow(c: Ctx, label: string, value: string | null | undefined, mandatory = false): void {
  const vt = val(value);
  const vlines = vt
    ? wrapText(vt, c.R, 8.5, VW - 10)
    : mandatory ? ['[OUTSTANDING — not provided]'] : ['—'];
  const llines = wrapText(label, c.R, 7.8, LW - 8);
  const nlines = Math.max(vlines.length, llines.length);
  const h = Math.max(RH, nlines * 11 + 7);

  ensureSpace(c, h + 1);
  const y0 = c.y;

  c.pg.drawRectangle({ x: MG,      y: y0 - h, width: LW, height: h, color: LBL_BG, borderColor: BORDER, borderWidth: 0.5 });
  c.pg.drawRectangle({ x: MG + LW, y: y0 - h, width: VW, height: h, color: WHITE,  borderColor: BORDER, borderWidth: 0.5 });

  llines.forEach((ln, i) =>
    c.pg.drawText(ln, { x: MG + 5, y: y0 - 11 - i * 11, font: c.R, size: 7.8, color: MID }),
  );

  const vc = !vt && mandatory ? RED : !vt ? LIGHT : DARK;
  const vf = !vt && mandatory ? c.B : c.R;
  vlines.forEach((ln, i) =>
    c.pg.drawText(ln, { x: MG + LW + 5, y: y0 - 11 - i * 11, font: vf, size: 8.5, color: vc }),
  );

  c.y -= h;
}

// ─── Full-width navy section heading ──────────────────────────────────────────
function secHead(c: Ctx, title: string): void {
  ensureSpace(c, 32);
  c.y -= 8;
  c.pg.drawRectangle({ x: MG, y: c.y - 17, width: CW, height: 20, color: NAVY });
  c.pg.drawText(title, { x: MG + 8, y: c.y - 12, font: c.B, size: 10, color: WHITE });
  c.y -= 22;
}

// ─── Numbered sub-section heading (light bg) ───────────────────────────────────
function numHead(c: Ctx, title: string): void {
  ensureSpace(c, 24);
  c.y -= 4;
  c.pg.drawRectangle({ x: MG, y: c.y - 14, width: CW, height: 16, color: rgb(0.94, 0.95, 0.97) });
  c.pg.drawText(title, { x: MG + 6, y: c.y - 10, font: c.B, size: 9, color: NAVY });
  c.y -= 16;
}

// ─── Sub-heading with left rule ────────────────────────────────────────────────
function subHead(c: Ctx, title: string): void {
  ensureSpace(c, 22);
  c.y -= 5;
  c.pg.drawRectangle({ x: MG, y: c.y - 13, width: 3, height: 15, color: RULE });
  c.pg.drawText(title, { x: MG + 8, y: c.y - 10, font: c.B, size: 8.5, color: NAVY });
  c.y -= 16;
}

function gap(c: Ctx, n = 6): void { c.y -= n; }

// ─── Italic note text ──────────────────────────────────────────────────────────
function note(c: Ctx, text: string): void {
  const lines = wrapText(text, c.R, 7.5, CW);
  lines.forEach((ln) => {
    ensureSpace(c, 11);
    c.pg.drawText(ln, { x: MG, y: c.y, font: c.R, size: 7.5, color: MID });
    c.y -= 11;
  });
}

// ─── Document checklist row ────────────────────────────────────────────────────
function checkRow(c: Ctx, label: string, checked: boolean, fileNames: string[] = []): void {
  const h = RH;
  const extraH = checked && fileNames.length > 0 ? fileNames.length * 11 : 0;
  ensureSpace(c, h + extraH + 1);

  const y0 = c.y;
  c.pg.drawRectangle({ x: MG,          y: y0 - h, width: CW - 14, height: h, color: WHITE,   borderColor: BORDER, borderWidth: 0.5 });
  c.pg.drawRectangle({ x: MG + CW - 14, y: y0 - h, width: 14,     height: h,
    color: checked ? rgb(0.94, 0.99, 0.96) : rgb(0.97, 0.97, 0.97),
    borderColor: BORDER, borderWidth: 0.5,
  });

  // Draw checkbox
  const bx = MG + CW - 11, by = y0 - h + 5;
  c.pg.drawRectangle({ x: bx, y: by, width: 8, height: 8,
    borderColor: checked ? GREEN : BORDER, borderWidth: 0.8,
    color: checked ? GREEN : WHITE,
  });
  if (checked) {
    c.pg.drawLine({ start: { x: bx + 1.5, y: by + 3.5 }, end: { x: bx + 3.5, y: by + 1.5 }, thickness: 1.1, color: WHITE });
    c.pg.drawLine({ start: { x: bx + 3.5, y: by + 1.5 }, end: { x: bx + 7,   y: by + 6   }, thickness: 1.1, color: WHITE });
  }

  c.pg.drawText(label, { x: MG + 6, y: y0 - 11, font: c.R, size: 8, color: DARK });
  c.y -= h;

  if (checked && fileNames.length > 0) {
    fileNames.forEach((fn) => {
      ensureSpace(c, 11);
      c.pg.drawText(`   -> ${sanitize(fn)}`, { x: MG + 20, y: c.y, font: c.R, size: 7, color: MID });
      c.y -= 11;
    });
  }
}

// ─── Multi-column person table ─────────────────────────────────────────────────
function personTable(c: Ctx, headers: string[], rows: string[][], colWidths: number[]): void {
  const total = colWidths.reduce((a, b) => a + b, 0);
  const scaled = colWidths.map((w) => (w / total) * CW);

  // Header row
  ensureSpace(c, RH + 2);
  let xc = MG;
  const hy = c.y;
  headers.forEach((h, i) => {
    c.pg.drawRectangle({ x: xc, y: hy - RH, width: scaled[i], height: RH, color: NAVY, borderColor: BORDER, borderWidth: 0.4 });
    c.pg.drawText(h, { x: xc + 4, y: hy - 12, font: c.B, size: 6.5, color: WHITE });
    xc += scaled[i];
  });
  c.y -= RH;

  // Data rows
  for (let ri = 0; ri < rows.length; ri++) {
    const rd = rows[ri];
    const cellHeights = rd.map((cell, ci) => {
      if (!cell.trim()) return RH;
      const lines = wrapText(cell, c.R, 7.5, scaled[ci] - 8);
      return Math.max(RH, lines.length * 10 + 4);
    });
    const rh = Math.max(RH, ...cellHeights);

    ensureSpace(c, rh + 1);
    const ry = c.y;
    const bg = ri % 2 === 0 ? WHITE : ROW_ALT;
    let xr = MG;

    rd.forEach((cell, ci) => {
      c.pg.drawRectangle({ x: xr, y: ry - rh, width: scaled[ci], height: rh, color: bg, borderColor: BORDER, borderWidth: 0.4 });
      if (cell.trim()) {
        const lines = wrapText(cell, c.R, 7.5, scaled[ci] - 8);
        lines.forEach((ln, li) =>
          c.pg.drawText(ln, { x: xr + 4, y: ry - 10 - li * 10, font: c.R, size: 7.5, color: DARK }),
        );
      }
      xr += scaled[ci];
    });
    c.y -= rh;
  }
  gap(c, 4);
}

// ─── Filter associated persons by role ────────────────────────────────────────
function personsOfRole(persons: AssociatedPerson[], ...keys: string[]): AssociatedPerson[] {
  return persons.filter((p) =>
    keys.some((k) => (p.person_role_type ?? '').toLowerCase().includes(k.toLowerCase())),
  );
}

function blankRows(n: number, cols: number): string[][] {
  return Array.from({ length: n }, () => Array(cols).fill(''));
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════════════
export async function generateKYCPdf(
  caseId: string,
  _token: string,
  counterparty: CounterpartyFull,
  documents: PrismaDocument[],
  mandatoryPercent: number,
  docsPercent: number,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const B = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const R = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Try to embed MC logo
  let logo: any = null;
  try {
    const logoBytes = await fs.readFile(path.join(process.cwd(), 'public', 'mc-logo.jpg'));
    logo = await pdfDoc.embedJpg(logoBytes);
  } catch { /* fall back to text logo */ }

  // Initialise context with cover page
  const coverPage = pdfDoc.addPage([PW, PH]);
  const c: Ctx = { doc: pdfDoc, pg: coverPage, B, R, logo, y: PH - MG, n: 1, caseId };

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 1 — COVER
  // ═══════════════════════════════════════════════════════════════════════════
  const top = PH - MG;

  // Logo (larger on cover)
  if (logo) {
    c.pg.drawImage(logo, { x: MG, y: top - 48, width: 110, height: 48 });
  } else {
    c.pg.drawText('MC.', { x: MG, y: top - 22, font: B, size: 28, color: NAVY });
    c.pg.drawText('METAL CONCENTRATORS', { x: MG, y: top - 36, font: R, size: 7, color: MID });
  }

  // Title (top-right)
  const ct1 = 'Know Your Counterparty';
  c.pg.drawText(ct1, { x: PW - MG - B.widthOfTextAtSize(ct1, 22), y: top - 20, font: B, size: 22, color: NAVY });
  const ct2 = 'Master data form for Customers and Suppliers';
  c.pg.drawText(ct2, { x: PW - MG - R.widthOfTextAtSize(ct2, 9.5), y: top - 34, font: R, size: 9.5, color: ORANGE });

  c.y = top - 60;
  c.pg.drawLine({ start: { x: MG, y: c.y }, end: { x: PW - MG, y: c.y }, thickness: 0.7, color: BORDER });
  c.y -= 14;

  // Counterparty Name box
  c.pg.drawRectangle({ x: MG, y: c.y - 54, width: CW, height: 57, color: WHITE, borderColor: BORDER, borderWidth: 0.8 });
  c.pg.drawText('Counterparty Name', { x: MG + 7, y: c.y - 10, font: B, size: 9, color: DARK });
  const cpName = val(counterparty.registered_name);
  if (cpName) {
    c.pg.drawText(cpName, { x: MG + 10, y: c.y - 30, font: B, size: 14, color: NAVY });
  }
  c.pg.drawLine({
    start: { x: MG + 10, y: c.y - 46 }, end: { x: PW - MG - 10, y: c.y - 46 },
    thickness: 0.5, color: BORDER,
  });
  c.y -= 60;
  gap(c, 14);

  // Introduction section header
  c.pg.drawRectangle({ x: MG, y: c.y - 13, width: CW, height: 16, color: rgb(0.94, 0.95, 0.97) });
  c.pg.drawText('Know Your Counterparty Introduction', { x: MG + 7, y: c.y - 9, font: B, size: 9, color: NAVY });
  c.y -= 18;

  // Introduction paragraphs
  const intro1 = 'Metal Concentrators SA (Pty) Ltd (MetCon) is an authorised dealer committed to responsible sourcing as a vital component of our long-term sustainability objectives. MetCon strives to maintain the highest standards for responsible sourcing and adheres to the Responsible Jewellery Council standards (RJC Code of Practice and Chain of Custody). We also comply with the Responsible Minerals Initiative (RMI) and the Financial Intelligence Centre Act (FICA) requirements. To maintain a credible supplier base and verifiable supply chain, MetCon is registered with the Financial Intelligence Centre (FIC) as an "Accountable Institution" dealing in high-value precious metals. Accountable Institutions are subjected to certain obligations in terms of the FIC Act, and thus must keep a record of specified details of our suppliers and customers.';
  wrapText(intro1, R, 8, CW).forEach((ln) => { c.pg.drawText(ln, { x: MG, y: c.y, font: R, size: 8, color: DARK }); c.y -= 11; });

  c.y -= 8;
  const intro2 = 'The RJC is the only industry standard covering the entire Jewellery supply chain and is a vital component to combatting money laundering, terrorist financing and human rights abuses, including child labour. MetCon has been audited and approved under the RJC Code of Practice 2019, which is aligned with the OECD Due Diligence Guidance and the UN Guiding Principles of Business and Human Rights. Through the application of the Code of Practice, we contribute towards the United Nations 2030 agenda and the 17 Sustainable Development Goals.';
  wrapText(intro2, R, 8, CW).forEach((ln) => { c.pg.drawText(ln, { x: MG, y: c.y, font: R, size: 8, color: DARK }); c.y -= 11; });

  c.y -= 12;

  // Compliance badges
  const bw = (CW - 12) / 4;
  const badges = [
    ['RESPONSIBLE', 'JEWELRY', 'COUNCIL', 'CERTIFIED MEMBER 0000 4678'],
    ['CHAIN', 'OF', 'CUSTODY', 'CERTIFIED NUMBER C0000 4679'],
    ['Financial', 'Intelligence', 'Centre', ''],
    ['RESPONSIBLE', 'MINERALS', 'INITIATIVE', ''],
  ];
  const badgeY = c.y;
  badges.forEach((b, i) => {
    const bx = MG + i * (bw + 4);
    c.pg.drawRectangle({ x: bx, y: badgeY - 55, width: bw, height: 57, color: rgb(0.11, 0.16, 0.31), borderColor: NAVY, borderWidth: 0.5 });
    c.pg.drawText(b[0], { x: bx + 6, y: badgeY - 14, font: B, size: 7.5, color: WHITE });
    c.pg.drawText(b[1], { x: bx + 6, y: badgeY - 25, font: B, size: 7.5, color: WHITE });
    c.pg.drawText(b[2], { x: bx + 6, y: badgeY - 36, font: B, size: 7.5, color: WHITE });
    if (b[3]) {
      c.pg.drawLine({ start: { x: bx + 6, y: badgeY - 43 }, end: { x: bx + bw - 6, y: badgeY - 43 }, thickness: 0.4, color: rgb(0.4, 0.5, 0.7) });
      c.pg.drawText(b[3], { x: bx + 6, y: badgeY - 51, font: R, size: 5.5, color: rgb(0.7, 0.75, 0.85) });
    }
  });
  c.y -= 60;

  drawFooter(c);

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 2 — DOCUMENTATION CHECKLIST
  // ═══════════════════════════════════════════════════════════════════════════
  newPage(c);

  const uploadedTypes = new Set(documents.map((d) => d.doc_type));
  const docsByType = new Map<string, PrismaDocument[]>();
  for (const d of documents) {
    const arr = docsByType.get(d.doc_type) ?? [];
    arr.push(d);
    docsByType.set(d.doc_type, arr);
  }

  secHead(c, 'Account Opening Documentation List');
  note(c, 'In line with the RJC and FICA requirements we request that the Company please submit the following documents (as applicable):\n-All documents must be submitted in English\n-If material changes take place the Company should inform MetCon');
  gap(c, 4);

  const docList: [string, string][] = [
    ['company_registration',    'Company Documents (e.g. Registration Certificate and / or CIPC)'],
    ['beneficial_ownership',    'Beneficial Ownership Certificate / Declaration noting ownership interest % (applicable to entities)'],
    ['group_structure',          'Group structure indicating % shareholding and/or ownership interest (applicable to entities)'],
    ['shareholder_certificates', 'Shareholder certificates and registers (applicable to entities)'],
    ['bbbee_cert',               'Affidavit for B-BBEE exempt micro enterprises or qualifying small enterprises or B-BBEE certificate (if applicable)'],
    ['vat_revalidation',         'Vat Domestic reverse charge Revalidation letter (DRC) (if applicable)'],
    ['tax_compliance',           'Valid tax compliance status pin / Tax Registration Certificates (if applicable)'],
    ['bank_confirmation',        'Bank confirmation letter (not older than 3 months) (if supplier)'],
    ['address_proof',            'Business address reflecting name of company (e.g. phone bill, electricity bill) — required if entity does not hold a valid precious metal permit / license'],
    ['id_passport',              'Clear copy of ID book / ID card (both sides) / passport / for all owners, directors, shareholders, and beneficiaries'],
    ['license_permit',           'Licenses and permits to trade precious metals (Jewellery / Second-Hand Goods License / Refinery) (if applicable)'],
    ['import_export_permit',     'Import or Export licenses and permits (if applicable)'],
    ['police_clearance',         'Valid police clearance certificates for owners and / or directors (not older than 12 months) (if supplier)'],
    ['supply_chain_declaration', 'MetCon Supply Chain Declaration (if supplier)'],
    ['aml_policy',               'AML/CFT Policy Document (if applicable)'],
    ['anti_bribery_policy',      'Anti-Bribery Policy Document (if applicable)'],
    ['association_proof',        'Precious Metal Association Membership Proof (if applicable)'],
  ];

  for (const [type, label] of docList) {
    const checked = uploadedTypes.has(type);
    const files = checked
      ? (docsByType.get(type) ?? []).map((d) => `${d.original_name} (${(d.file_size / 1024).toFixed(1)} KB)`)
      : [];
    checkRow(c, label, checked, files);
  }

  gap(c, 10);
  note(c, 'Note — Indemnity: All signatories agree that MetCon and/or the data providers shall not incur liability, and no claims will be made for any compensation in respect of any document or information obtained through such inquiries conducted in good faith. MetCon will not be held liable for relying on any inaccurate, misleading or outdated personal information provided by the data provider/s.');

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 3+ — SECTION A: APPLICANT DETAILS
  // ═══════════════════════════════════════════════════════════════════════════
  newPage(c);
  secHead(c, 'Section A \u2013 Customer and / or Supplier');
  numHead(c, '1. Applicant Details');

  tRow(c, '1.1.   Registered name', counterparty.registered_name, !counterparty.registered_name);
  tRow(c, '1.2.   Type of entity (e.g. (Pty) Ltd, Ltd, Sole proprietor)', counterparty.entity_type, !counterparty.entity_type);
  tRow(c, '1.3.   Registration number / Identity number / Passport number', counterparty.registration_or_id_number, !counterparty.registration_or_id_number);
  tRow(c, '1.4.   Business address including postal code', counterparty.business_address, !counterparty.business_address);
  tRow(c, '1.5.   Business phone number \u2014 Tel (Work)', counterparty.business_phone_work);
  tRow(c, '        Tel (Cell No.)', counterparty.business_phone_cell);
  tRow(c, '1.6.   Business e-mail address', counterparty.email_address, !counterparty.email_address);
  tRow(c, '1.7.   Type of business (e.g. Jewellers, Coin Dealer)', counterparty.type_of_business, !counterparty.type_of_business);
  tRow(c, '1.8.   Contact person \u2014 Name & Surname', counterparty.contact_person_name);
  tRow(c, '        Tel (Work & Cell No.)', [counterparty.contact_person_tel_work, counterparty.contact_person_tel_cell].filter(Boolean).join(' / ') || null);
  tRow(c, '        Email address', counterparty.contact_person_email);
  tRow(c, '1.9.   FICA Org ID (registered as high-value goods dealer)', counterparty.fica_org_id);
  tRow(c, '1.10. Website address (if applicable)', counterparty.website);
  tRow(c, '1.11. Tax registration number', counterparty.tax_number);
  tRow(c, '1.12. VAT registration number', counterparty.vat_number);
  tRow(c, '1.13. VAT period category (A / B / C / D / E)', counterparty.vat_category);

  const branchText = counterparty.multiple_branches === true
    ? `Yes \u2014 ${counterparty.branch_count ?? '?'} branches`
    : counterparty.multiple_branches === false ? 'No' : null;
  tRow(c, '1.14. Does the Company have multiple branches?', branchText);

  const pepText = counterparty.pep_related === true
    ? `Yes \u2014 ${counterparty.pep_relationship_details ?? 'details not specified'}`
    : counterparty.pep_related === false ? 'No' : null;
  tRow(c, '1.15. Are you related to a Politically Exposed Person (PEP)?', pepText);

  // ─── Section 2: Directors, Owners, Signatories ────────────────────────────
  gap(c, 6);
  numHead(c, '2. Directors, Owners, and Authorised Signatories');
  note(c, 'MetCon is committed to the principles of responsible sourcing and always verifies the beneficial owners and principal management layer of the Company that it deals with.');
  gap(c, 4);

  const PERSON_COLS4 = [3, 3, 3, 2.5];

  // 2.1 Directors
  subHead(c, '1.1. Directors, Members and/or owners');
  const directors = personsOfRole(counterparty.associated_persons, 'director', 'member', 'owner');
  const dirRows = directors.length > 0
    ? directors.map((p) => [p.person_full_name ?? '', p.person_address ?? '', p.person_nationality ?? p.country_of_incorporation ?? '', p.person_id_or_passport ?? ''])
    : blankRows(3, 4);
  personTable(c, ['Name and Surname', 'Residential Address', 'Country of incorporation / Nationality(ies)', 'Identification or Passport Number'], dirRows, PERSON_COLS4);

  // 2.2 Shareholders
  subHead(c, '1.2. Shareholder(s) (5% and more)');
  const shareholders = personsOfRole(counterparty.associated_persons, 'shareholder');
  const shRows = shareholders.length > 0
    ? shareholders.map((p) => [p.person_full_name ?? '', p.person_address ?? '', p.person_nationality ?? p.country_of_incorporation ?? '', p.person_id_or_passport ?? ''])
    : blankRows(3, 4);
  personTable(c, ['Name and Surname / Company Name', 'Residential or Business Address', 'Country of incorporation / Nationality(ies)', 'Identification or Passport Number'], shRows, PERSON_COLS4);

  // 2.3 UBOs
  subHead(c, '1.3. Ultimate beneficial owners (5% or more \u2013 individual only)');
  const ubos = personsOfRole(counterparty.associated_persons, 'ubo', 'ultimate beneficial');
  const uboRows = ubos.length > 0
    ? ubos.map((p) => [p.person_full_name ?? '', p.person_address ?? '', p.person_designation ?? '', p.person_id_or_passport ?? ''])
    : blankRows(3, 4);
  personTable(c, ['Name and Surname', 'Residential Address', 'Capacity/Designation', 'Identification or Passport Number'], uboRows, [3, 3, 2, 2.5]);

  // 2.4 Authorised Signatories
  subHead(c, '1.4. Authorities to trade (if not completed, a Resolution Letter would be required)');
  const sigs = personsOfRole(counterparty.associated_persons, 'authorised signatory', 'authority', 'signatory');
  const sigRows = sigs.length > 0
    ? sigs.map((p) => [p.person_full_name ?? '', [p.person_email, p.person_phone].filter(Boolean).join(' / '), p.person_designation ?? '', p.person_id_or_passport ?? ''])
    : blankRows(3, 4);
  personTable(c, ['Name and Surname', 'Email Address and Cell Number', 'Capacity/Designation', 'Identification or Passport Number'], sigRows, [3, 3, 2, 2.5]);

  // ─── Section 3: Financials ─────────────────────────────────────────────────
  gap(c, 6);
  numHead(c, '3. Financials');
  note(c, 'The purpose of this section is to ensure that if any refunds, credit notes or other payments become due from MetCon to yourselves, that we have the required banking information to process that payment and that you are audited as required by the relevant regulation (e.g. FICA).');

  subHead(c, '3.1 Banking details');
  tRow(c, 'Bank name', counterparty.bank_name);
  tRow(c, 'Account name', counterparty.account_name);
  tRow(c, 'Account number', counterparty.account_number);
  tRow(c, 'Branch code or name', [counterparty.branch_code, counterparty.branch_name].filter(Boolean).join(' / ') || null);
  tRow(c, 'Swift code', counterparty.swift_code);

  subHead(c, '3.2 Auditor details');
  tRow(c, 'Name of audit company', counterparty.audit_company_name);
  tRow(c, 'Auditors contact number (Work)', counterparty.auditor_phone_work);
  tRow(c, 'Auditors contact number (Cell)', counterparty.auditor_phone_cell);
  tRow(c, 'Date of last audit (DD/MM/YYYY)', counterparty.last_audit_date);

  subHead(c, '3.3 Source of funding');
  note(c, 'In terms of the FIC Act, we need to understand the origin of the funds involved in a business relationship or a single transaction.');
  tRow(c, 'Please specify the source of funding', counterparty.source_of_funds_description);

  // ─── Section 4: Business Activity ─────────────────────────────────────────
  gap(c, 6);
  numHead(c, '4. Business Activity');
  note(c, 'Business activity is important for us to validate the type of Customer/Supplier that you are, and that your associated licenses / permits correspond to the type of product that you wish to purchase from MetCon.');

  let btypes = '';
  try { if (counterparty.business_type_checkboxes) btypes = JSON.parse(counterparty.business_type_checkboxes).join(', '); } catch { /* */ }
  tRow(c, '4.1  Type of business', btypes || null);
  tRow(c, '4.2  Description of core business activity', counterparty.business_activity_description);

  const licHeld = counterparty.holds_license;
  let licTypes = '';
  try { if (counterparty.license_types) licTypes = JSON.parse(counterparty.license_types).join(', '); } catch { /* */ }
  const licText = licHeld === true
    ? `Yes${licTypes ? ' \u2014 ' + licTypes : ''}`
    : licHeld === false ? 'No' : null;
  tRow(c, '4.3  Does the Company hold a license / permit to conduct its business(es)?', licText);
  if (licHeld) {
    tRow(c, '4.4  License number', counterparty.license_number);
    tRow(c, '     License expiry date', counterparty.license_expiry_date);
  }

  // ─── Section B: Customer Facilities ───────────────────────────────────────
  gap(c, 6);
  secHead(c, 'Section B \u2013 Customer');
  numHead(c, '5. Facilities and Materials Type for Customers');

  tRow(c, '5.1  Does the Company have any smelting or refining facilities?', val(counterparty.has_smelting_facilities) || null);
  tRow(c, '5.2  Does the Company have any manufacturing facilities?', val(counterparty.has_manufacturing_facilities) || null);
  tRow(c, '5.3  Does the Company produce its own retail products?', val(counterparty.produces_retail_products) || null);

  let cMetals = '';
  try {
    if (counterparty.customer_metals_json) {
      const m = JSON.parse(counterparty.customer_metals_json) as Record<string, boolean>;
      cMetals = Object.entries(m).filter(([, v]) => v).map(([k]) => k).join(', ');
    }
  } catch { /* */ }
  let cForms = '';
  try { if (counterparty.metal_forms_json) cForms = JSON.parse(counterparty.metal_forms_json).join(', '); } catch { /* */ }
  tRow(c, '5.4  Type of precious metals planned to purchase', [cMetals, cForms].filter(Boolean).join(' \u2014 ') || null);

  let assoc = '';
  try { if (counterparty.association_memberships_json) assoc = JSON.parse(counterparty.association_memberships_json).join(', '); } catch { /* */ }
  tRow(c, '5.5  Precious metal association membership', assoc || (counterparty.precious_metal_association === false ? 'None' : null));

  // ─── Section C: Supplier Facilities ───────────────────────────────────────
  gap(c, 6);
  secHead(c, 'Section C \u2013 Supplier');
  numHead(c, '6. Facilities and Materials Type for Suppliers');

  tRow(c, '6.1  Does the Company have any smelting or refining facilities?', val(counterparty.has_smelting_facilities) || null);
  tRow(c, '6.2  Does the Company have any manufacturing facilities?', val(counterparty.has_manufacturing_facilities) || null);
  tRow(c, '6.3  Does the Company produce its own retail products?', val(counterparty.produces_retail_products) || null);

  let sMetals = '';
  try {
    if (counterparty.supplier_metals_json) {
      const m = JSON.parse(counterparty.supplier_metals_json) as Record<string, boolean>;
      sMetals = Object.entries(m).filter(([, v]) => v).map(([k]) => k).join(', ');
    }
  } catch { /* */ }
  tRow(c, '6.4  Type of precious metals planned to send for refining', sMetals || null);
  tRow(c, '6.5  Percentage of source material', counterparty.source_material_percentage);
  tRow(c, '6.6  Profile of the supplying entity', counterparty.supplier_profile);
  tRow(c, '6.7  Origin country of source material', counterparty.source_material_country);

  const qtyParts: string[] = [];
  if (counterparty.unprocessed_recycled_kg) qtyParts.push(`Unprocessed recycled: ${counterparty.unprocessed_recycled_kg} kg/month`);
  if (counterparty.jewellers_sweeps_kg)     qtyParts.push(`Jewellers sweeps: ${counterparty.jewellers_sweeps_kg} kg/month`);
  if (counterparty.melted_recycled_kg)      qtyParts.push(`Melted recycled: ${counterparty.melted_recycled_kg} kg/month`);
  if (counterparty.primary_mined_kg)        qtyParts.push(`Primary mined: ${counterparty.primary_mined_kg} kg/month`);
  tRow(c, '6.8  Form and quantity of precious metals planned for refining', qtyParts.join('; ') || null);

  if (counterparty.mine_name || counterparty.mine_address || counterparty.mining_permit_number) {
    tRow(c, '     Mine name', counterparty.mine_name);
    tRow(c, '     Mine address', counterparty.mine_address);
    tRow(c, '     Mining permit number', counterparty.mining_permit_number);
  }

  // ─── Section 7: AML / CFT ─────────────────────────────────────────────────
  gap(c, 6);
  numHead(c, '7. Anti-Money Laundering (AML) \u2013 Combating Financial Terrorism (CFT)');

  tRow(c, '7.1  Is your Company subject to AML / CFT law / regulation?', val(counterparty.subject_to_aml_law) || null);
  tRow(c, '7.2  Name of the AML / CFT law / regulation', counterparty.aml_law_name);
  tRow(c, '7.3  Name of the Regulator', counterparty.aml_regulator);
  tRow(c, '7.4  Has your Company established a conformity program with AML / CFT policies and procedures?', val(counterparty.has_aml_conformity_program) || null);
  tRow(c, '7.5  Compliance Officer name', counterparty.aml_responsible_person_name);
  tRow(c, '     Compliance Officer phone', counterparty.aml_responsible_person_phone);
  tRow(c, '     Compliance Officer email', counterparty.aml_responsible_person_email);

  // ─── Section 8: Anti-Bribery ──────────────────────────────────────────────
  gap(c, 6);
  numHead(c, '8. Anti-Bribery Policy');

  tRow(c, '8.1  Does your Company have an anti-bribery policy in place?', val(counterparty.has_anti_bribery_policy) || null);
  tRow(c, '8.2  Has the Company or Senior Management ever been charged for violation of applicable anti-bribery laws or regulations?', val(counterparty.charged_for_anti_bribery) || null);
  tRow(c, '8.3  Does the company provide AML/CFT training to its employees?', val(counterparty.provides_aml_training) || null);

  // ─── Section 9: Transaction Monitoring ───────────────────────────────────
  gap(c, 6);
  numHead(c, '9. Transaction Monitoring');

  tRow(c, '9.1  Does the Company perform a risk-based assessment to understand the normal and expected transactions of its suppliers?', val(counterparty.performs_risk_assessment) || null);
  tRow(c, '9.2  Does the Company have a procedure to prevent, detect and report suspicious transactions?', val(counterparty.suspicious_tx_reporting) || null);
  if (counterparty.suspicious_detection_details) tRow(c, '     Details', counterparty.suspicious_detection_details);
  tRow(c, '9.3  Does the Company have to register / declare all precious metals purchases and sales in accordance with local legislation?', val(counterparty.registers_precious_metal_tx) || null);
  tRow(c, '9.4  Does the Company monitor unusual and potentially suspicious activity of your suppliers?', val(counterparty.monitors_unusual_activity) || null);
  if (counterparty.unusual_activity_details) tRow(c, '     Details', counterparty.unusual_activity_details);
  tRow(c, '9.5  Does the Company have procedures to identify structured transactions to avoid money laundering?', val(counterparty.structured_tx_procedures) || null);
  tRow(c, '9.6  Maximum amount allowed for cash payments and EFTs', counterparty.max_cash_amount != null ? `ZAR ${counterparty.max_cash_amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` : null);

  const hasPurchaseData = counterparty.supplier_bank_pct != null || counterparty.supplier_company_pct != null || counterparty.supplier_individual_pct != null;
  if (hasPurchaseData) {
    subHead(c, '9.6. Purchase source breakdown (average per deal)');
    personTable(c,
      ['Supplier type', 'Purchase percentage (%)'],
      [
        ['Bank',       counterparty.supplier_bank_pct       != null ? `${counterparty.supplier_bank_pct}%`       : ''],
        ['Company',    counterparty.supplier_company_pct    != null ? `${counterparty.supplier_company_pct}%`    : ''],
        ['Individual', counterparty.supplier_individual_pct != null ? `${counterparty.supplier_individual_pct}%` : ''],
      ],
      [2, 1.5],
    );
  }

  const hasPaymentData = counterparty.payment_bank_transfer_pct != null || counterparty.payment_cheque_pct != null || counterparty.payment_cash_pct != null;
  if (hasPaymentData) {
    subHead(c, '9.7. Payment method breakdown (last financial year)');
    personTable(c,
      ['Payment type', 'Percentage (%)'],
      [
        ['Bank transfers', counterparty.payment_bank_transfer_pct != null ? `${counterparty.payment_bank_transfer_pct}%` : ''],
        ['Cheques',        counterparty.payment_cheque_pct        != null ? `${counterparty.payment_cheque_pct}%`        : ''],
        ['Cash',           counterparty.payment_cash_pct          != null ? `${counterparty.payment_cash_pct}%`          : ''],
      ],
      [2, 1.5],
    );
  }

  // ─── Section D: Declaration & Consent ────────────────────────────────────
  gap(c, 6);
  secHead(c, 'Section D \u2013 Customer and / or Supplier');
  numHead(c, '10. Declaration and Consent');

  note(c, '10.1 I / we hereby declare that the information given is true and accurate as of the date indicated below. I / we undertake to inform MetCon as soon as possible of any changes to the information provided.');
  gap(c, 4);

  tRow(c, '10.1 Information is true and accurate as at the date below', val(counterparty.info_true_declaration) || null, !counterparty.info_true_declaration);
  tRow(c, '10.2 Authorise MetCon to process personal information for FICA / POPI compliance', val(counterparty.fica_processing_authorised) || null, !counterparty.fica_processing_authorised);
  tRow(c, '10.3 POPIA Consent given', val(counterparty.popia_consent) || null, !counterparty.popia_consent);
  tRow(c, '10.4.1 Is the beneficial owner of goods delivered to MetCon', val(counterparty.confirms_beneficial_owner_goods) || null);
  tRow(c, '10.4.3 Has taken all necessary measures to prevent acquisition of criminal goods', val(counterparty.confirms_prevent_criminal_goods) || null);
  tRow(c, '10.4.5 Does not use child labour or forced / compulsory labour', val(counterparty.confirms_no_forced_labour) || null);
  tRow(c, '10.4.6 Complies with applicable environmental regulations', val(counterparty.confirms_environmental_compliance) || null);
  tRow(c, '10.4.7 Does not offer bribery to Public Officials or private sector employees', val(counterparty.confirms_no_bribery) || null);
  tRow(c, '10.4.8 OECD Annex II Due Diligence Commitment', val(counterparty.commits_to_oecd) || null);

  gap(c, 8);
  note(c, '10.5 Undertakings: OECD Due Diligence Guidance \u2014 http://www.oecd.org/daf/inv/mne/mining.html');
  note(c, 'RJC Responsible code of practice guidance \u2014 https://www.responsiblejewellery.com');
  gap(c, 10);

  // ─── Signature Block ──────────────────────────────────────────────────────
  ensureSpace(c, 72);
  c.pg.drawText('10.6 I hereby declare that I am duly authorised to sign as below:', {
    x: MG, y: c.y, font: B, size: 8.5, color: DARK,
  });
  c.y -= 12;

  const sigH = 58;
  c.pg.drawRectangle({ x: MG, y: c.y - sigH, width: CW, height: sigH, color: rgb(0.968, 0.972, 0.978), borderColor: BORDER, borderWidth: 0.8 });

  c.pg.drawText('Name:', { x: MG + 8, y: c.y - 14, font: B, size: 8.5, color: MID });
  c.pg.drawText(
    val(counterparty.declaration_signature_name) || '_______________________________________________',
    { x: MG + 46, y: c.y - 14, font: R, size: 8.5, color: DARK },
  );

  c.pg.drawText('Position:', { x: MG + 8, y: c.y - 28, font: B, size: 8.5, color: MID });
  c.pg.drawText(
    val(counterparty.declaration_signature_position) || '___________________________________________',
    { x: MG + 52, y: c.y - 28, font: R, size: 8.5, color: DARK },
  );

  c.pg.drawText('Date:', { x: MG + 8, y: c.y - 44, font: B, size: 8.5, color: MID });
  c.pg.drawText(
    val(counterparty.declaration_signature_date) || '______________________________',
    { x: MG + 42, y: c.y - 44, font: R, size: 8.5, color: DARK },
  );
  c.pg.drawText('Signature:', { x: MG + 278, y: c.y - 44, font: B, size: 8.5, color: MID });
  c.pg.drawLine({
    start: { x: MG + 330, y: c.y - 44 }, end: { x: MG + CW - 8, y: c.y - 44 },
    thickness: 0.6, color: BORDER,
  });
  c.y -= sigH;

  // ─── Final metadata note ──────────────────────────────────────────────────
  gap(c, 12);
  note(c, `MetCon KYC Pack  \u00B7  Case ID: ${caseId}  \u00B7  Generated: ${new Date().toLocaleDateString('en-ZA', { dateStyle: 'medium' })}  \u00B7  CONFIDENTIAL`);
  note(c, `Mandatory fields: ${mandatoryPercent}% complete  \u00B7  Documents submitted: ${docsPercent}%`);

  return pdfDoc.save();
}
