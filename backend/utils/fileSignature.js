import fs from "fs";

// Verifies a file's actual bytes match its claimed extension, so a renamed
// executable or arbitrary payload can't ride in as "resume.pdf". Checked
// against magic numbers — cheap and reliable for the types PrintDrop accepts.
const SIGNATURES = {
  ".pdf":  [[0x25, 0x50, 0x44, 0x46]],                        // %PDF
  ".jpg":  [[0xFF, 0xD8, 0xFF]],
  ".jpeg": [[0xFF, 0xD8, 0xFF]],
  ".png":  [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  ".docx": [[0x50, 0x4B, 0x03, 0x04]],                        // DOCX is a ZIP (OOXML)
  ".doc":  [[0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]], // legacy OLE compound file
};

function matches(buffer, signature) {
  if (buffer.length < signature.length) return false;
  return signature.every((byte, i) => buffer[i] === byte);
}

export function isFileSignatureValid(filePath, ext) {
  const sigs = SIGNATURES[ext.toLowerCase()];
  if (!sigs) return false; // unknown extension — reject by default
  const fd = fs.openSync(filePath, "r");
  const buffer = Buffer.alloc(8);
  fs.readSync(fd, buffer, 0, 8, 0);
  fs.closeSync(fd);
  return sigs.some((sig) => matches(buffer, sig));
}