import fs from "fs";
import path from "path";
import os from "os";
import { execFileSync } from "child_process";
import { PDFDocument } from "pdf-lib";

// Cache whether LibreOffice is on this server so we don't re-probe every upload.
let sofficeAvailable = null;
function hasSoffice() {
  if (sofficeAvailable !== null) return sofficeAvailable;
  try {
    execFileSync("soffice", ["--version"], { stdio: "ignore", timeout: 10000 });
    sofficeAvailable = true;
  } catch {
    sofficeAvailable = false;
  }
  return sofficeAvailable;
}

// Converts DOC/DOCX to PDF with headless LibreOffice and returns the exact
// page count. Requires LibreOffice on the server — e.g. in your Dockerfile:
//   RUN apt-get update && apt-get install -y --no-install-recommends libreoffice
async function countDocPagesViaLibreOffice(filePath) {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "printdrop-count-"));
  try {
    execFileSync("soffice", ["--headless", "--norestore", "--convert-to", "pdf", "--outdir", outDir, filePath], {
      timeout: 60000,
    });
    const pdfPath = path.join(outDir, path.basename(filePath, path.extname(filePath)) + ".pdf");
    const bytes = fs.readFileSync(pdfPath);
    const pdf = await PDFDocument.load(bytes);
    return pdf.getPageCount();
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
}

// Fallback ONLY if LibreOffice isn't installed on this server: a rough
// estimate from file size (~40KB per typical text page of a modern .docx),
// deliberately rounded UP so a shop is never underpaid. Not exact — install
// LibreOffice on the server for accurate DOC/DOCX pricing.
function estimateDocPagesBySize(filePath) {
  const { size } = fs.statSync(filePath);
  const BYTES_PER_PAGE = 40 * 1024;
  return Math.max(1, Math.ceil(size / BYTES_PER_PAGE));
}

export async function getPageCount(filePath) {
    const ext = path.extname(filePath).toLowerCase();

    try {
        if (ext === ".pdf") {
            const bytes = fs.readFileSync(filePath);
            const pdf = await PDFDocument.load(bytes);
            return pdf.getPageCount();
        }

        if ([".jpg", ".jpeg", ".png"].includes(ext)) {
            return 1;
        }

        if ([".doc", ".docx"].includes(ext)) {
            if (hasSoffice()) {
                try {
                    return await countDocPagesViaLibreOffice(filePath);
                } catch (err) {
                    console.error("LibreOffice page count failed, falling back to estimate:", err);
                }
            }
            return estimateDocPagesBySize(filePath);
        }

        return 1;
    } catch (err) {
        console.error("Page counter error:", err);
        return 1;
    }
}