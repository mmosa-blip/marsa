import { readFileSync, writeFileSync } from "fs";
import { inflateRawSync } from "zlib";

// Simple DOCX parser — read ZIP, find document.xml, extract text
const buffer = readFileSync("Downloads/الاستثمار الخدمي.docx");

// Parse ZIP central directory to find document.xml
function findEntry(buf: Buffer, name: string): Buffer | null {
  // Find end of central directory
  let eocdPos = -1;
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 65558; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocdPos = i; break; }
  }
  if (eocdPos < 0) return null;

  const cdOffset = buf.readUInt32LE(eocdPos + 16);
  const cdCount = buf.readUInt16LE(eocdPos + 10);

  let pos = cdOffset;
  for (let i = 0; i < cdCount; i++) {
    if (buf.readUInt32LE(pos) !== 0x02014b50) break;
    const method = buf.readUInt16LE(pos + 10);
    const compSize = buf.readUInt32LE(pos + 20);
    const uncompSize = buf.readUInt32LE(pos + 24);
    const nameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const localHeaderOffset = buf.readUInt32LE(pos + 42);
    const fileName = buf.toString("utf8", pos + 46, pos + 46 + nameLen);

    if (fileName === name) {
      // Read local file header
      const localNameLen = buf.readUInt16LE(localHeaderOffset + 26);
      const localExtraLen = buf.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
      const compressed = buf.slice(dataStart, dataStart + compSize);

      if (method === 0) return compressed;
      if (method === 8) return inflateRawSync(compressed);
      return null;
    }

    pos += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

const docXmlBuf = findEntry(buffer, "word/document.xml");
if (!docXmlBuf) {
  console.error("Could not find word/document.xml");
  process.exit(1);
}

const docXml = docXmlBuf.toString("utf8");

// Extract paragraphs
const paragraphs: string[] = [];
const pRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
let m;
while ((m = pRegex.exec(docXml)) !== null) {
  const pContent = m[1];
  const tRegex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
  let text = "";
  let tm;
  while ((tm = tRegex.exec(pContent)) !== null) {
    text += tm[1]
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"');
  }
  if (text.trim()) paragraphs.push(text.trim());
}

const output = paragraphs.join("\n");
writeFileSync("Downloads/extracted.txt", output);
console.log(output);
console.log(`\n\n=== Total paragraphs: ${paragraphs.length} ===`);
