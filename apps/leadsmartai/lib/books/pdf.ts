import "server-only";

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatMoney } from "./money";

export type InvoicePdfInput = {
  business: string;
  invoiceNumber: string;
  issueDate?: string | null;
  dueDate?: string | null;
  clientName?: string | null;
  clientEmail?: string | null;
  currency: string;
  lines: { description: string; quantity: number; unitPrice: number; amount: number }[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  notes?: string | null;
};

const DARK = rgb(0.13, 0.13, 0.13);
const GRAY = rgb(0.42, 0.42, 0.42);
const LIGHT = rgb(0.85, 0.85, 0.85);

/** Render an invoice as a single-page US-Letter PDF (pure pdf-lib, serverless-safe). */
export async function renderInvoicePdf(inv: InvoicePdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();
  const M = 50;
  const cur = inv.currency || "USD";

  const draw = (
    s: string,
    x: number,
    y: number,
    opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb> } = {},
  ) =>
    page.drawText(String(s ?? ""), {
      x,
      y,
      size: opts.size ?? 10,
      font: opts.bold ? bold : font,
      color: opts.color ?? DARK,
    });

  const drawRight = (
    s: string,
    xRight: number,
    y: number,
    opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb> } = {},
  ) => {
    const size = opts.size ?? 10;
    const f: PDFFont = opts.bold ? bold : font;
    const w = f.widthOfTextAtSize(String(s ?? ""), size);
    draw(s, xRight - w, y, opts);
  };

  const hline = (y: number, thickness = 0.5, color = LIGHT) =>
    (page as PDFPage).drawLine({ start: { x: M, y }, end: { x: width - M, y }, thickness, color });

  let y = height - M;

  // Header
  draw(inv.business || "Invoice", M, y, { size: 18, bold: true });
  drawRight(`Invoice ${inv.invoiceNumber}`, width - M, y, { size: 12, bold: true });
  y -= 18;
  draw("INVOICE", M, y, { size: 10, bold: true, color: GRAY });
  if (inv.issueDate) {
    drawRight(`Issued: ${inv.issueDate}`, width - M, y, { size: 9, color: GRAY });
    y -= 12;
  } else {
    y -= 12;
  }
  if (inv.dueDate) {
    drawRight(`Due: ${inv.dueDate}`, width - M, y, { size: 9, color: GRAY });
    y -= 12;
  }
  y -= 14;

  // Bill to
  draw("BILL TO", M, y, { size: 8, bold: true, color: GRAY });
  y -= 14;
  if (inv.clientName) {
    draw(inv.clientName, M, y, { size: 11 });
    y -= 13;
  }
  if (inv.clientEmail) {
    draw(inv.clientEmail, M, y, { size: 9, color: GRAY });
    y -= 13;
  }
  y -= 14;

  // Table header
  const colQty = 360;
  const colUnit = 450;
  const colAmt = width - M;
  hline(y, 1.2, DARK);
  y -= 14;
  draw("Description", M, y, { size: 9, bold: true, color: GRAY });
  drawRight("Qty", colQty, y, { size: 9, bold: true, color: GRAY });
  drawRight("Unit", colUnit, y, { size: 9, bold: true, color: GRAY });
  drawRight("Amount", colAmt, y, { size: 9, bold: true, color: GRAY });
  y -= 8;
  hline(y, 0.5, LIGHT);
  y -= 16;

  // Rows
  for (const l of inv.lines) {
    draw(String(l.description).slice(0, 58), M, y);
    drawRight(String(l.quantity), colQty, y);
    drawRight(formatMoney(l.unitPrice, cur), colUnit, y);
    drawRight(formatMoney(l.amount, cur), colAmt, y);
    y -= 16;
    hline(y + 4, 0.4, LIGHT);
    if (y < 160) break; // single page guard
  }
  y -= 10;

  // Totals
  drawRight("Subtotal", colUnit, y, { color: GRAY });
  drawRight(formatMoney(inv.subtotal, cur), colAmt, y);
  y -= 15;
  if (inv.taxAmount > 0) {
    drawRight(`Tax (${(inv.taxRate * 100).toFixed(2)}%)`, colUnit, y, { color: GRAY });
    drawRight(formatMoney(inv.taxAmount, cur), colAmt, y);
    y -= 15;
  }
  (page as PDFPage).drawLine({ start: { x: 360, y: y + 5 }, end: { x: width - M, y: y + 5 }, thickness: 1, color: DARK });
  drawRight("Total", colUnit, y, { bold: true, size: 12 });
  drawRight(formatMoney(inv.total, cur), colAmt, y, { bold: true, size: 12 });
  y -= 30;

  // Notes
  if (inv.notes && y > 80) {
    draw("NOTES", M, y, { size: 8, bold: true, color: GRAY });
    y -= 14;
    for (const line of wrapText(inv.notes, 95).slice(0, 6)) {
      draw(line, M, y, { size: 9, color: GRAY });
      y -= 12;
      if (y < 50) break;
    }
  }

  draw(`${inv.business} — thank you for your business.`, M, 40, { size: 8, color: GRAY });

  return doc.save();
}

function wrapText(s: string, n: number): string[] {
  const words = String(s).replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > n) {
      if (cur) lines.push(cur.trim());
      cur = w;
    } else {
      cur = (cur + " " + w).trim();
    }
  }
  if (cur) lines.push(cur.trim());
  return lines;
}
