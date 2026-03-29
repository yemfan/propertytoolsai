import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { buildHomeValueReportHtml } from "./report-template";

type GeneratePdfInput = {
  address: string;
  estimateValue: number;
  rangeLow: number;
  rangeHigh: number;
  confidence: string;
  medianPpsf?: number;
  localTrendPct?: number;
  compCount?: number;
  actions?: string[];
  sessionId: string;
};

export async function generateHomeValueReportPdf(input: GeneratePdfInput) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();

    const html = buildHomeValueReportHtml(input);
    await page.setContent(html, { waitUntil: "load" });

    const outputDir = path.join(process.cwd(), "tmp", "home-value-reports");
    await fs.mkdir(outputDir, { recursive: true });

    const outputPath = path.join(outputDir, `${input.sessionId}.pdf`);

    await page.pdf({
      path: outputPath,
      format: "A4",
      printBackground: true,
      margin: {
        top: "20px",
        right: "20px",
        bottom: "20px",
        left: "20px",
      },
    });

    return {
      outputPath,
      filename: `${input.sessionId}.pdf`,
    };
  } finally {
    await browser.close();
  }
}
