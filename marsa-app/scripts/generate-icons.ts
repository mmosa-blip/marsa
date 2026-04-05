/**
 * Generate professional app icons for Marsa
 * Uses SVG → PNG conversion via sharp (if available) or outputs SVGs
 */
import { writeFileSync } from "fs";

// Marsa icon as SVG: dark bg with gold geometric "M" mark
function generateSvg(size: number): string {
  const pad = Math.round(size * 0.15);
  const s = size;
  const inner = s - pad * 2;
  const cx = s / 2;
  const cy = s / 2;
  const r = inner / 2;

  // Geometric "M" inspired by Islamic geometry
  const mTop = cy - r * 0.45;
  const mBot = cy + r * 0.45;
  const mLeft = cx - r * 0.5;
  const mRight = cx + r * 0.5;
  const mMid = cx;
  const mPeak = cy - r * 0.15;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" rx="${Math.round(s * 0.2)}" fill="#1C1B2E"/>
  <rect x="${pad * 0.8}" y="${pad * 0.8}" width="${s - pad * 1.6}" height="${s - pad * 1.6}" rx="${Math.round(s * 0.15)}" fill="#2A2542"/>
  <!-- Gold border accent -->
  <rect x="${pad * 0.8}" y="${pad * 0.8}" width="${s - pad * 1.6}" height="${s - pad * 1.6}" rx="${Math.round(s * 0.15)}" fill="none" stroke="#C9A84C" stroke-width="${Math.max(1, Math.round(s * 0.015))}" opacity="0.4"/>
  <!-- M letterform -->
  <path d="M ${mLeft} ${mBot} L ${mLeft} ${mTop} L ${mMid} ${mPeak} L ${mRight} ${mTop} L ${mRight} ${mBot}"
    fill="none" stroke="#C9A84C" stroke-width="${Math.max(2, Math.round(s * 0.06))}" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- Dot accent -->
  <circle cx="${mMid}" cy="${cy + r * 0.25}" r="${Math.max(1, Math.round(s * 0.035))}" fill="#C9A84C"/>
  <!-- Small diamond -->
  <path d="M ${mMid} ${cy - r * 0.6} l ${r * 0.08} ${r * 0.08} l ${-r * 0.08} ${r * 0.08} l ${-r * 0.08} ${-r * 0.08} z" fill="#C9A84C" opacity="0.6"/>
</svg>`;
}

// Generate SVGs and save
const sizes = [16, 32, 180, 192, 512];
for (const size of sizes) {
  const svg = generateSvg(size);
  writeFileSync(`scripts/icon-${size}.svg`, svg);
  console.log(`Generated icon-${size}.svg`);
}

// Main icon SVG for conversion reference
writeFileSync("public/images/marsa-icon.svg", generateSvg(512));
console.log("Generated public/images/marsa-icon.svg");

console.log("\nTo convert SVGs to PNGs, run:");
console.log("  npx sharp-cli icon-512.svg -o public/images/icon-512.png");
console.log("  Or use https://cloudconvert.com/svg-to-png");
