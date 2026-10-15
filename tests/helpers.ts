import { PDFDocument, StandardFonts } from "pdf-lib";
import { PGlite } from "@electric-sql/pglite";
import { setDb } from "@/lib/server/db";

export async function makePdf(pages: string[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const t of pages) {
    const p = doc.addPage();
    if (t) p.drawText(t, { x: 40, y: 700, size: 14, font });
  }
  return doc.save();
}

export async function freshDb() {
  const pg = new PGlite();
  setDb({ query: async (t, p) => ({ rows: (await pg.query(t, p as never[])).rows as never[] }) });
  return pg;
}
