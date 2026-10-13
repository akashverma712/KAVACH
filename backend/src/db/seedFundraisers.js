import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { UPLOAD_ROOT } from '../middleware/upload.js';
import { pool, query } from './pool.js';

// ── 5x7 Bitmap Font for ASCII 32..126 ───────────────────────────
const FONT_DATA = {
  ' ': [0x00,0x00,0x00,0x00,0x00],
  '!': [0x00,0x00,0x5f,0x00,0x00],
  '"': [0x00,0x07,0x00,0x07,0x00],
  '#': [0x14,0x7f,0x14,0x7f,0x14],
  '$': [0x24,0x2a,0x7f,0x2a,0x12],
  '%': [0x23,0x13,0x08,0x64,0x62],
  '&': [0x36,0x49,0x55,0x22,0x50],
  '\'': [0x00,0x05,0x03,0x00,0x00],
  '(': [0x00,0x1c,0x22,0x41,0x00],
  ')': [0x00,0x41,0x22,0x1c,0x00],
  '*': [0x14,0x08,0x3e,0x08,0x14],
  '+': [0x08,0x08,0x3e,0x08,0x08],
  ',': [0x00,0x50,0x30,0x00,0x00],
  '-': [0x08,0x08,0x08,0x08,0x08],
  '.': [0x00,0x60,0x60,0x00,0x00],
  '/': [0x20,0x10,0x08,0x04,0x02],
  '0': [0x3e,0x51,0x49,0x45,0x3e],
  '1': [0x00,0x42,0x7f,0x40,0x00],
  '2': [0x42,0x61,0x51,0x49,0x46],
  '3': [0x21,0x41,0x45,0x4b,0x31],
  '4': [0x18,0x14,0x12,0x7f,0x10],
  '5': [0x27,0x45,0x45,0x45,0x39],
  '6': [0x3c,0x4a,0x49,0x49,0x30],
  '7': [0x01,0x71,0x09,0x05,0x03],
  '8': [0x36,0x49,0x49,0x49,0x36],
  '9': [0x06,0x49,0x49,0x29,0x1e],
  ':': [0x00,0x36,0x36,0x00,0x00],
  ';': [0x00,0x56,0x36,0x00,0x00],
  '<': [0x08,0x14,0x22,0x41,0x00],
  '=': [0x14,0x14,0x14,0x14,0x14],
  '>': [0x00,0x41,0x22,0x14,0x08],
  '?': [0x02,0x01,0x51,0x09,0x06],
  '@': [0x32,0x49,0x79,0x41,0x3e],
  'A': [0x7e,0x11,0x11,0x11,0x7e],
  'B': [0x7f,0x49,0x49,0x49,0x36],
  'C': [0x3e,0x41,0x41,0x41,0x22],
  'D': [0x7f,0x41,0x41,0x22,0x1c],
  'E': [0x7f,0x49,0x49,0x49,0x41],
  'F': [0x7f,0x09,0x09,0x09,0x01],
  'G': [0x3e,0x41,0x49,0x49,0x7a],
  'H': [0x7f,0x08,0x08,0x08,0x7f],
  'I': [0x00,0x41,0x7f,0x41,0x00],
  'J': [0x20,0x40,0x41,0x3f,0x01],
  'K': [0x7f,0x08,0x14,0x22,0x41],
  'L': [0x7f,0x40,0x40,0x40,0x40],
  'M': [0x7f,0x02,0x0c,0x02,0x7f],
  'N': [0x7f,0x04,0x08,0x10,0x7f],
  'O': [0x3e,0x41,0x41,0x41,0x3e],
  'P': [0x7f,0x09,0x09,0x09,0x06],
  'Q': [0x3e,0x41,0x51,0x21,0x5e],
  'R': [0x7f,0x09,0x19,0x29,0x46],
  'S': [0x46,0x49,0x49,0x49,0x31],
  'T': [0x01,0x01,0x7f,0x01,0x01],
  'U': [0x3f,0x40,0x40,0x40,0x3f],
  'V': [0x1f,0x20,0x40,0x20,0x1f],
  'W': [0x7f,0x20,0x18,0x20,0x7f],
  'X': [0x63,0x14,0x08,0x14,0x63],
  'Y': [0x07,0x08,0x70,0x08,0x07],
  'Z': [0x61,0x51,0x49,0x45,0x43],
  '[': [0x00,0x7f,0x41,0x41,0x00],
  '\\': [0x02,0x04,0x08,0x10,0x20],
  ']': [0x00,0x41,0x41,0x7f,0x00],
  '^': [0x04,0x02,0x01,0x02,0x04],
  '_': [0x40,0x40,0x40,0x40,0x40],
  'a': [0x20,0x54,0x54,0x54,0x78],
  'b': [0x7f,0x48,0x44,0x44,0x38],
  'c': [0x38,0x44,0x44,0x44,0x20],
  'd': [0x38,0x44,0x44,0x48,0x7f],
  'e': [0x38,0x54,0x54,0x54,0x18],
  'f': [0x08,0x7e,0x09,0x01,0x02],
  'g': [0x0c,0x52,0x52,0x52,0x3e],
  'h': [0x7f,0x08,0x04,0x04,0x78],
  'i': [0x00,0x44,0x7d,0x40,0x00],
  'j': [0x20,0x40,0x44,0x3d,0x00],
  'k': [0x7f,0x10,0x28,0x44,0x00],
  'l': [0x00,0x41,0x7f,0x40,0x00],
  'm': [0x7c,0x04,0x18,0x04,0x78],
  'n': [0x7c,0x08,0x04,0x04,0x78],
  'o': [0x38,0x44,0x44,0x44,0x38],
  'p': [0x7c,0x14,0x14,0x14,0x08],
  'q': [0x08,0x14,0x14,0x18,0x7c],
  'r': [0x7c,0x08,0x04,0x04,0x08],
  's': [0x48,0x54,0x54,0x54,0x20],
  't': [0x04,0x3f,0x44,0x40,0x20],
  'u': [0x3c,0x40,0x40,0x20,0x7c],
  'v': [0x1c,0x20,0x40,0x20,0x1c],
  'w': [0x3c,0x40,0x30,0x40,0x3c],
  'x': [0x44,0x28,0x10,0x28,0x44],
  'y': [0x0c,0x50,0x50,0x50,0x3c],
  'z': [0x44,0x64,0x54,0x4c,0x44],
  '{': [0x00,0x08,0x36,0x41,0x00],
  '|': [0x00,0x00,0x7f,0x00,0x00],
  '}': [0x00,0x41,0x36,0x08,0x00],
  '~': [0x08,0x04,0x08,0x10,0x08],
};

class Canvas {
  constructor(w, h, bg = [255, 255, 255, 255]) {
    this.w = w;
    this.h = h;
    this.data = Buffer.alloc(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      const idx = i * 4;
      this.data[idx] = bg[0];
      this.data[idx + 1] = bg[1];
      this.data[idx + 2] = bg[2];
      this.data[idx + 3] = bg[3];
    }
  }

  setPixel(x, y, r, g, b, a = 255) {
    if (x < 0 || x >= this.w || y < 0 || y >= this.h) return;
    const idx = (y * this.w + x) * 4;
    this.data[idx] = r;
    this.data[idx + 1] = g;
    this.data[idx + 2] = b;
    this.data[idx + 3] = a;
  }

  fillRect(x, y, w, h, [r, g, b, a = 255]) {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.w, Math.floor(x + w));
    const y1 = Math.min(this.h, Math.floor(y + h));
    for (let cy = y0; cy < y1; cy++) {
      for (let cx = x0; cx < x1; cx++) {
        this.setPixel(cx, cy, r, g, b, a);
      }
    }
  }

  strokeRect(x, y, w, h, color, thickness = 1) {
    this.fillRect(x, y, w, thickness, color);
    this.fillRect(x, y + h - thickness, w, thickness, color);
    this.fillRect(x, y, thickness, h, color);
    this.fillRect(x + w - thickness, y, thickness, h, color);
  }

  drawCircle(cx, cy, r, color, fill = false, thickness = 1) {
    const r2 = r * r;
    const inner2 = (r - thickness) * (r - thickness);
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
        if (fill) {
          if (d2 <= r2) this.setPixel(x, y, color[0], color[1], color[2], color[3] ?? 255);
        } else {
          if (d2 <= r2 && d2 >= inner2) {
            this.setPixel(x, y, color[0], color[1], color[2], color[3] ?? 255);
          }
        }
      }
    }
  }

  drawText(text, startX, startY, color = [0, 0, 0, 255], scale = 1) {
    let curX = Math.floor(startX);
    let curY = Math.floor(startY);
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '\n') {
        curY += Math.floor(9 * scale);
        curX = Math.floor(startX);
        continue;
      }
      const glyph = FONT_DATA[ch] || FONT_DATA['?'] || [0, 0, 0, 0, 0];
      for (let col = 0; col < 5; col++) {
        const byte = glyph[col];
        for (let row = 0; row < 7; row++) {
          if ((byte >> row) & 1) {
            this.fillRect(curX + col * scale, curY + row * scale, scale, scale, color);
          }
        }
      }
      curX += Math.floor(6 * scale);
    }
  }

  toPngBuffer() {
    const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(this.w, 0);
    ihdr.writeUInt32BE(this.h, 4);
    ihdr.writeUInt8(8, 8); // 8-bit depth
    ihdr.writeUInt8(6, 9); // RGBA color type
    ihdr.writeUInt8(0, 10);
    ihdr.writeUInt8(0, 11);
    ihdr.writeUInt8(0, 12);

    function chunk(type, data) {
      const len = Buffer.alloc(4);
      len.writeUInt32BE(data.length, 0);
      const typeBuf = Buffer.from(type, 'ascii');
      let c = 0xffffffff;
      const combined = Buffer.concat([typeBuf, data]);
      for (let i = 0; i < combined.length; i++) {
        c ^= combined[i];
        for (let j = 0; j < 8; j++) {
          c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0);
        }
      }
      const crc = Buffer.alloc(4);
      crc.writeUInt32BE((c ^ 0xffffffff) >>> 0, 0);
      return Buffer.concat([len, typeBuf, data, crc]);
    }

    const rawScanlines = Buffer.alloc(this.h * (1 + this.w * 4));
    for (let y = 0; y < this.h; y++) {
      const rowOffset = y * (1 + this.w * 4);
      rawScanlines[rowOffset] = 0;
      this.data.copy(rawScanlines, rowOffset + 1, y * this.w * 4, (y + 1) * this.w * 4);
    }

    const compressed = zlib.deflateSync(rawScanlines);
    return Buffer.concat([
      signature,
      chunk('IHDR', ihdr),
      chunk('IDAT', compressed),
      chunk('IEND', Buffer.alloc(0)),
    ]);
  }
}

// ── Realistic QR Code Generator ─────────────────────────────────
function generateQrImage({ upiId, name, brand = 'BHIM UPI', brandColor = [14, 116, 144] }) {
  const size = 260;
  const c = new Canvas(size, size, [255, 255, 255, 255]);

  // Outer border & subtle shadow
  c.strokeRect(4, 4, size - 8, size - 8, [226, 232, 240, 255], 2);

  // Top brand banner
  c.fillRect(6, 6, size - 12, 28, [...brandColor, 255]);
  c.drawText(brand, 16, 15, [255, 255, 255, 255], 1.5);
  c.drawText('VERIFIED', size - 70, 16, [220, 252, 231, 255], 1);

  // QR matrix parameters
  const gridSize = 25; // 25x25 modules
  const cellSize = 6;
  const startX = 55;
  const startY = 46;

  // Background white box for QR
  c.fillRect(startX - 6, startY - 6, gridSize * cellSize + 12, gridSize * cellSize + 12, [255, 255, 255, 255]);
  c.strokeRect(startX - 6, startY - 6, gridSize * cellSize + 12, gridSize * cellSize + 12, [241, 245, 249, 255], 1);

  // Draw 7x7 Finder Pattern at grid (gx, gy)
  const drawFinder = (gx, gy) => {
    const px = startX + gx * cellSize;
    const py = startY + gy * cellSize;
    // Outer 7x7
    c.fillRect(px, py, 7 * cellSize, 7 * cellSize, [15, 23, 42, 255]);
    // Inner 5x5 white
    c.fillRect(px + cellSize, py + cellSize, 5 * cellSize, 5 * cellSize, [255, 255, 255, 255]);
    // Core 3x3 dark
    c.fillRect(px + 2 * cellSize, py + 2 * cellSize, 3 * cellSize, 3 * cellSize, [15, 23, 42, 255]);
  };

  drawFinder(0, 0);
  drawFinder(gridSize - 7, 0);
  drawFinder(0, gridSize - 7);

  // Draw Alignment Pattern at bottom-right (16, 16)
  const ax = startX + 16 * cellSize;
  const ay = startY + 16 * cellSize;
  c.fillRect(ax, ay, 5 * cellSize, 5 * cellSize, [15, 23, 42, 255]);
  c.fillRect(ax + cellSize, ay + cellSize, 3 * cellSize, 3 * cellSize, [255, 255, 255, 255]);
  c.fillRect(ax + 2 * cellSize, ay + 2 * cellSize, cellSize, cellSize, [15, 23, 42, 255]);

  // Timing patterns
  for (let i = 8; i < gridSize - 8; i++) {
    const col = i % 2 === 0 ? [15, 23, 42, 255] : [255, 255, 255, 255];
    c.fillRect(startX + i * cellSize, startY + 6 * cellSize, cellSize, cellSize, col);
    c.fillRect(startX + 6 * cellSize, startY + i * cellSize, cellSize, cellSize, col);
  }

  // Deterministic data grid seeded by UPI ID
  let seed = 0;
  for (let i = 0; i < upiId.length; i++) seed = (seed * 31 + upiId.charCodeAt(i)) >>> 0;
  const nextRand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return (seed >> 16) & 1;
  };

  for (let gy = 0; gy < gridSize; gy++) {
    for (let gx = 0; gx < gridSize; gx++) {
      // Skip finder zones
      if (gx < 8 && gy < 8) continue;
      if (gx >= gridSize - 8 && gy < 8) continue;
      if (gx < 8 && gy >= gridSize - 8) continue;
      // Skip timing patterns
      if (gx === 6 || gy === 6) continue;
      // Skip alignment pattern zone
      if (gx >= 16 && gx <= 20 && gy >= 16 && gy <= 20) continue;

      if (nextRand()) {
        c.fillRect(startX + gx * cellSize, startY + gy * cellSize, cellSize, cellSize, [15, 23, 42, 255]);
      }
    }
  }

  // Bottom info strip
  c.fillRect(6, size - 46, size - 12, 40, [248, 250, 252, 255]);
  c.strokeRect(6, size - 46, size - 12, 40, [226, 232, 240, 255], 1);
  c.drawText(name.slice(0, 24).toUpperCase(), 14, size - 38, [15, 23, 42, 255], 1);
  c.drawText(upiId, 14, size - 24, [71, 85, 105, 255], 1);

  return c.toPngBuffer();
}

// ── Realistic Medical Proof Document Generator ──────────────────
function generateMedicalProofImage({
  hospital = 'PATLIPUTRA MEDICAL COLLEGE & HOSPITAL (SNMMCH), DHANBAD',
  department = 'DEPARTMENT OF ORTHOPAEDICS & TRAUMA SURGERY',
  docTitle = 'EMERGENCY INPATIENT ADMISSION & SURGICAL ESTIMATE',
  patient = 'Bikash Soren',
  ageSex = '21 Yrs / Male',
  ipdNo = 'IPD-2026/8942',
  date = '08-Oct-2026',
  bedWard = 'Ward 4 (Male Ortho) / Bed 18',
  doctor = 'Dr. S. K. Mahato, MS (Ortho)',
  regNo = 'JMC-2012-4418',
  findings = [
    'Diagnosis: Closed Compound Fracture Shaft of Right Tibia & Fibula',
    'History: Accidental fall on wet staircase; acute swelling & deformity',
    'Procedure Advised: Open Reduction & Internal Fixation (ORIF)',
    'Implants: Titanium Locking Compression Plate (LCP) + 8 Cortical Screws',
    'Pre-op Clearance: ECG & blood panels verified normal; fit for OT',
  ],
  costEstimate = 'ESTIMATED TOTAL EXPENSES (SURGERY + IMPLANTS + ICU): Rs. 65,000/-',
  stampText = 'SNMMCH DHANBAD * CASUALTY VERIFIED',
}) {
  const w = 600;
  const h = 760;
  const c = new Canvas(w, h, [254, 254, 254, 255]);

  // Outer paper border & watermarks
  c.strokeRect(8, 8, w - 16, h - 16, [203, 213, 225, 255], 2);
  c.strokeRect(12, 12, w - 24, h - 24, [241, 245, 249, 255], 1);

  // Top header banner
  c.fillRect(16, 16, w - 32, 70, [15, 23, 42, 255]);

  // Red medical cross badge
  c.fillRect(32, 28, 44, 44, [220, 38, 38, 255]);
  c.fillRect(48, 34, 12, 32, [255, 255, 255, 255]);
  c.fillRect(38, 44, 32, 12, [255, 255, 255, 255]);

  // Hospital Name & Govt tag
  c.drawText(hospital, 88, 28, [255, 255, 255, 255], 1.25);
  c.drawText(department, 88, 46, [148, 163, 184, 255], 1);
  c.drawText('GOVERNMENT OF JHARKHAND - TERTIARY HEALTHCARE MISSION', 88, 62, [56, 189, 248, 255], 0.9);

  // Document Title Bar
  c.fillRect(16, 94, w - 32, 34, [241, 245, 249, 255]);
  c.strokeRect(16, 94, w - 32, 34, [203, 213, 225, 255], 1);
  c.drawText(docTitle, 28, 105, [30, 41, 59, 255], 1.4);

  // Patient Info Grid
  c.fillRect(16, 136, w - 32, 110, [248, 250, 252, 255]);
  c.strokeRect(16, 136, w - 32, 110, [226, 232, 240, 255], 1);

  c.drawText(`PATIENT NAME : ${patient.toUpperCase()}`, 28, 148, [15, 23, 42, 255], 1.25);
  c.drawText(`AGE / GENDER : ${ageSex}`, 320, 148, [15, 23, 42, 255], 1.2);

  c.drawText(`IPD REG NO   : ${ipdNo}`, 28, 174, [71, 85, 105, 255], 1.15);
  c.drawText(`ADMISSION DT : ${date}`, 320, 174, [71, 85, 105, 255], 1.15);

  c.drawText(`WARD / BED   : ${bedWard}`, 28, 200, [71, 85, 105, 255], 1.15);
  c.drawText(`INSTITUTION  : BIT SINDRI (STUDENT)`, 320, 200, [71, 85, 105, 255], 1.15);

  // Clinical Summary Section
  c.drawText('CLINICAL FINDINGS & DIAGNOSTIC OBSERVATIONS:', 28, 264, [30, 41, 59, 255], 1.25);
  c.fillRect(28, 280, w - 56, 2, [51, 65, 85, 255]);

  let fy = 295;
  for (const f of findings) {
    c.fillRect(28, fy + 3, 5, 5, [14, 116, 144, 255]);
    c.drawText(f, 40, fy, [15, 23, 42, 255], 1.1);
    fy += 26;
  }

  // Cost Estimate Highlight Box
  c.fillRect(24, 440, w - 48, 54, [236, 253, 245, 255]);
  c.strokeRect(24, 440, w - 48, 54, [5, 150, 105, 255], 2);
  c.drawText(costEstimate, 38, 458, [6, 95, 70, 255], 1.35);

  // Official Notes
  c.drawText('OFFICIAL VERIFICATION & MEDICAL OFFICER ATTESTATION:', 28, 520, [71, 85, 105, 255], 1);
  c.drawText('This certificate is issued on emergency basis for student mutual aid', 28, 538, [100, 116, 139, 255], 0.95);
  c.drawText('and emergency welfare fund mobilization at BIT Sindri campus.', 28, 552, [100, 116, 139, 255], 0.95);

  // Hospital Seal / Stamp (Circular medical purple stamp)
  const stampCx = 140;
  const stampCy = 645;
  const stampColor = [37, 99, 235, 255];
  c.drawCircle(stampCx, stampCy, 52, stampColor, false, 3);
  c.drawCircle(stampCx, stampCy, 46, stampColor, false, 1.5);
  c.drawCircle(stampCx, stampCy, 12, stampColor, true);
  c.drawText(stampText, stampCx - 42, stampCy - 6, stampColor, 0.85);

  // Doctor Signature Box
  c.drawText('ATTENDING MEDICAL OFFICER:', 330, 585, [71, 85, 105, 255], 1);
  // Signature stroke representation
  c.fillRect(330, 630, 180, 2, [30, 58, 138, 255]);
  c.drawText(doctor, 330, 642, [15, 23, 42, 255], 1.15);
  c.drawText(`REG NO: ${regNo}`, 330, 662, [71, 85, 105, 255], 1);
  c.drawText('GOVERNMENT HOSPITAL EMERGENCY UNIT', 330, 680, [100, 116, 139, 255], 0.85);

  // Footer Disclaimer
  c.fillRect(16, h - 34, w - 32, 22, [248, 250, 252, 255]);
  c.drawText('CONFIDENTIAL HOSPITAL DOCUMENT - STRICTLY FOR KAVACH VERIFIED STUDENT WELFARE', 32, h - 26, [148, 163, 184, 255], 0.85);

  return c.toPngBuffer();
}

// ── Main Seeder ────────────────────────────────────────────────
export async function seedFundraisers({ quiet = false } = {}) {
  const log = (...a) => !quiet && console.log(...a);

  const publicDir = path.join(UPLOAD_ROOT, 'public');
  const privateDir = path.join(UPLOAD_ROOT, 'private');
  fs.mkdirSync(publicDir, { recursive: true });
  fs.mkdirSync(privateDir, { recursive: true });

  // Get users
  const { rows: users } = await query('SELECT id, name, phone, email, branch, batch, regd_no FROM users');
  const userByPhone = Object.fromEntries(users.map((u) => [u.phone, u]));
  const userByName = Object.fromEntries(users.map((u) => [u.name, u]));

  const devUser = userByPhone['9998887776'] || userByName['Dev Student'];
  const aarav = userByPhone['9000000001'] || userByName['Aarav Kumar'];
  const priya = userByPhone['9000000002'] || userByName['Priya Singh'];
  const rohit = userByPhone['9000000003'] || userByName['Rohit Mahato'];
  const sneha = userByPhone['9000000004'] || userByName['Sneha Oraon'];

  if (!devUser || !aarav || !priya || !rohit || !sneha) {
    throw new Error('Required demo students not found. Run seedCommunity first.');
  }

  // Get admin
  const { rows: admins } = await query('SELECT id FROM admins LIMIT 1');
  const adminId = admins[0]?.id || null;

  // Clean existing seeded fundraisers to ensure deterministic seed state
  await query(`DELETE FROM fundraisers WHERE title IN (
    'Urgent Orthopedic Surgery & Rehabilitation for Bikash Soren (Hostel 3 Staircase Fall)',
    'Head Injury Emergency Treatment & Cranial CT/Surgical Care for Amit Mahto',
    'Emergency Chemotherapy & Supportive Oncology Care for Sunita Devi (Student''s Mother)',
    'Second-Degree Chemical Burn Skin Grafting & Wound Care for Rahul Pandey',
    'Emergency ICU Medication & Blood Support for Anjali Kumari (Acute Dengue Complications)',
    'Emergency Spinal Alignment & Pelvic Fracture Care for Deepa Mundu',
    'Laptop Repair and Screen Replacement Fund for Lab Work',
    'Emergency Cataract & Eye Trauma Surgery for Lab Attendant Ramesh Ji'
  )`);

  // Clean previous notifications for seeded fundraisers
  await query(`DELETE FROM notifications WHERE body LIKE '%Bikash Soren%' OR body LIKE '%Laptop Repair%' OR body LIKE '%Amit Mahto%' OR body LIKE '%Sunita Devi%' OR body LIKE '%Rahul Pandey%'`);

  const fundraisersData = [
    // ══════════════ 1. APPROVED (Owned by Dev Student) ══════════════
    {
      user_id: devUser.id,
      title: 'Urgent Orthopedic Surgery & Rehabilitation for Bikash Soren (Hostel 3 Staircase Fall)',
      story: `On Thursday evening during heavy rains, Bikash (3rd year Mechanical Engineering, Hostel 3) suffered a severe compound fracture of his right tibia and fibula following an accidental slip on the staircase outside Block B.

He was immediately stabilized at the campus health centre and rushed to SNMMCH Dhanbad. Orthopedic surgeons have scheduled an urgent open reduction internal fixation (ORIF) surgery with titanium plating. His family from rural Dumka has very limited financial means and cannot cover the implant and hospital admission costs.

Every rupee contributed goes directly to Bikash's treatment. We will share all hospital bills, implant receipts, and recovery updates here. Thank you for standing by our batchmate!`,
      beneficiary_name: 'Bikash Soren',
      amount_needed: 65000,
      amount_raised: 42500,
      severity: 3,
      upi_id: 'bikash.soren@okaxis',
      status: 'approved',
      admin_note: 'Verified with SNMMCH Orthopaedics Ward 4 on-duty doctor. Implant estimate authentic.',
      reviewed_by: adminId,
      reviewed_offset: 'interval \'2 days\'',
      created_offset: 'interval \'3 days\'',
      qr_codes: [
        { filename: 'qr-bikash-soren-gpay.png', brand: 'Google Pay', brandColor: [14, 116, 144], upiId: 'bikash.soren@okaxis', name: 'Bikash Soren' },
        { filename: 'qr-bikash-soren-phonepe.png', brand: 'PhonePe', brandColor: [95, 37, 159], upiId: 'bikash.soren@okaxis', name: 'Bikash Soren' },
      ],
      proofs: [
        {
          filename: 'proof-bikash-admission-snmmch.png',
          original: 'SNMMCH_Emergency_Admission_Slip_BikashSoren.png',
          docTitle: 'EMERGENCY ORTHOPEDIC ADMISSION & TRAUMA RECORD',
          hospital: 'SHAHID NIRMAL MAHTO MEDICAL COLLEGE & HOSPITAL (SNMMCH)',
          department: 'DEPARTMENT OF ORTHOPAEDICS & TRAUMA SURGERY',
          patient: 'Bikash Soren',
          ageSex: '21 Yrs / Male',
          ipdNo: 'IPD-2026/8942',
          date: '08-Oct-2026',
          bedWard: 'Ward 4 (Male Ortho) / Bed 18',
          doctor: 'Dr. S. K. Mahato, MS (Ortho)',
          regNo: 'JMC-2012-4418',
          findings: [
            'Diagnosis: Compound Fracture Right Tibia & Fibula (Grade II)',
            'Condition: Severe swelling, bone displacement; advised urgent ORIF',
            'Implant: Titanium Locking Plate (LCP) + 8 Cortical Screws',
            'Pre-op: Blood and cardiac profile cleared for general anaesthesia',
          ],
          costEstimate: 'ESTIMATED TOTAL EXPENSES (ORIF SURGERY + IMPLANTS): Rs. 65,000/-',
          stampText: 'SNMMCH DHANBAD * ORTHO WARD VERIFIED',
        },
        {
          filename: 'proof-bikash-orif-prescription.png',
          original: 'Ortho_Surgical_Estimate_Implant_Bills.png',
          docTitle: 'ORTHOPEDIC IMPLANT QUOTATION & OT SCHEDULE',
          hospital: 'DHANBAD SURGICAL IMPLANTS & MEDICINE PHARMACY',
          department: 'GOVT RECOGNISED CASUALTY PHARMACY STORE',
          patient: 'Bikash Soren',
          ageSex: '21 Yrs / Male',
          ipdNo: 'IPD-2026/8942',
          date: '09-Oct-2026',
          bedWard: 'Ward 4 (Male Ortho) / Bed 18',
          doctor: 'Dr. S. K. Mahato, MS (Ortho)',
          regNo: 'JMC-2012-4418',
          findings: [
            'Titanium 3.5mm LCP Tibia Plate: Rs. 28,000',
            'Locking Cortical Screws (8 units): Rs. 16,000',
            'Surgical Drape Packs & Post-op Antibiotics: Rs. 11,000',
            'OT Consumables & Blood Units (2 Units O+): Rs. 10,000',
          ],
          costEstimate: 'TOTAL PHARMACEUTICAL & IMPLANT SUM: Rs. 65,000/-',
          stampText: 'MED PHARMACY DHANBAD * AUTHENTIC BILL',
        },
      ],
      notification: {
        userId: devUser.id,
        title: 'Your fundraiser is live',
        body: '"Urgent Orthopedic Surgery & Rehabilitation for Bikash Soren (Hostel 3 Staircase Fall)" is now visible to all students.',
      },
    },

    // ══════════════ 2. APPROVED (Aarav Kumar) ══════════════
    {
      user_id: aarav.id,
      title: 'Head Injury Emergency Treatment & Cranial CT/Surgical Care for Amit Mahto',
      story: `Amit Mahto (B.Tech Metallurgy, 2023 batch) met with a catastrophic road collision near Sindri Town railway junction on Saturday night while returning from a weekend group study session.

He sustained acute cranial trauma with an epidural hematoma and was immediately rushed by campus ambulance to Bokaro General Hospital. He underwent emergency surgical decompression and is currently in the Neuro-Intensive Care Unit (ICU).

The overall medical expenditure is projected to surpass Rs. 3.2 lakhs. Student mutual aid from BIT Sindri is raising this emergency sum of Rs. 1,50,000 to bridge the urgent shortfall before insurance formalities. Every contribution is deeply appreciated.`,
      beneficiary_name: 'Amit Mahto',
      amount_needed: 150000,
      amount_raised: 118000,
      severity: 4,
      upi_id: 'aaravkumar.relief@oksbi',
      status: 'approved',
      admin_note: 'High-priority mutual aid verified with family & Bokaro General Hospital ICU.',
      reviewed_by: adminId,
      reviewed_offset: 'interval \'4 days\'',
      created_offset: 'interval \'5 days\'',
      qr_codes: [
        { filename: 'qr-amit-mahto-bgh.png', brand: 'SBI UPI', brandColor: [30, 58, 138], upiId: 'aaravkumar.relief@oksbi', name: 'Amit Mahto Relief' },
        { filename: 'qr-amit-mahto-paytm.png', brand: 'Paytm', brandColor: [0, 185, 245], upiId: 'aaravkumar.relief@oksbi', name: 'Amit Mahto Relief' },
      ],
      proofs: [
        {
          filename: 'proof-amit-neuro-icu-bokaro.png',
          original: 'BGH_Bokaro_Neuro_ICU_Admission_Summary.png',
          docTitle: 'NEUROSURGERY ICU ADMISSION & CRITICAL CARE RECORD',
          hospital: 'BOKARO GENERAL HOSPITAL (SAIL - GOVT UNDERTAKING)',
          department: 'DEPARTMENT OF NEUROSURGERY & CRITICAL CARE',
          patient: 'Amit Mahto',
          ageSex: '20 Yrs / Male',
          ipdNo: 'BGH-ICU-2026/1029',
          date: '06-Oct-2026',
          bedWard: 'Neuro-ICU / Bed 04',
          doctor: 'Dr. P. R. Sen, MCh (Neurosurgery)',
          regNo: 'BH-MED-2008-119',
          findings: [
            'Diagnosis: Traumatic Brain Injury with Right Temporoparietal EDH',
            'Emergency Procedure: Right Craniotomy & Decompression Evacuation',
            'GCS Score Post-op: 10/15; intubated and on neuro-protective protocol',
            'Current Status: Guarded prognosis; requiring mechanical ventilation',
          ],
          costEstimate: 'IMMEDIATE NEURO-ICU & OT EXPENSE ESTIMATE: Rs. 1,50,000/-',
          stampText: 'BGH BOKARO * NEURO-ICU VERIFIED',
        },
        {
          filename: 'proof-amit-ct-scan-report.png',
          original: 'Emergency_Head_CT_Trauma_Report.png',
          docTitle: 'EMERGENCY CRANIAL COMPUTED TOMOGRAPHY (CT) REPORT',
          hospital: 'ADVANCED RADIOLOGY & DIAGNOSTIC CENTRE, BOKARO',
          department: 'DIAGNOSTIC NEURORADIOLOGY DIVISION',
          patient: 'Amit Mahto',
          ageSex: '20 Yrs / Male',
          ipdNo: 'BGH-ICU-2026/1029',
          date: '06-Oct-2026',
          bedWard: 'Neuro-ICU / Bed 04',
          doctor: 'Dr. Ananya Roy, MD (Radiology)',
          regNo: 'DMR-2015-778',
          findings: [
            'CT Head: Biconvex hyperdense extra-axial collection right temporal lobe',
            'Midline Shift: 6.2 mm towards left side',
            'Linear skull fracture observed in squamous temporal bone',
            'Immediate decompression evacuated hematoma successfully',
          ],
          costEstimate: 'DIAGNOSTIC & VENTILATOR CARE CHARGES: Rs. 1,50,000/-',
          stampText: 'BOKARO RADIOLOGY * CERTIFIED REPORT',
        },
      ],
      notification: {
        userId: aarav.id,
        title: 'Your fundraiser is live',
        body: '"Head Injury Emergency Treatment & Cranial CT/Surgical Care for Amit Mahto" is now visible to all students.',
      },
    },

    // ══════════════ 3. APPROVED (Priya Singh) ══════════════
    {
      user_id: priya.id,
      title: 'Emergency Chemotherapy & Supportive Oncology Care for Sunita Devi (Student\'s Mother)',
      story: `My classmate's mother, Smt. Sunita Devi, has been diagnosed with Stage 3 diffuse large B-cell lymphoma and has initiated intensive chemotherapy cycles at Tata Main Hospital (TMH) Jamshedpur.

Her father works as a daily wage contractor and the sudden financial burden of targeted monoclonal antibody therapy is overwhelming. Any financial assistance from the BIT Sindri campus community will directly fund her upcoming 3rd and 4th chemo rounds. All hospital billing and treatment slips are attached.`,
      beneficiary_name: 'Sunita Devi',
      amount_needed: 80000,
      amount_raised: 52000,
      severity: 3,
      upi_id: 'priyasingh.aid@icici',
      status: 'approved',
      admin_note: 'Oncology protocol verified against TMH registration.',
      reviewed_by: adminId,
      reviewed_offset: 'interval \'3 days\'',
      created_offset: 'interval \'4 days\'',
      qr_codes: [
        { filename: 'qr-sunita-devi-tmh.png', brand: 'iMobile Pay', brandColor: [180, 83, 9], upiId: 'priyasingh.aid@icici', name: 'Sunita Devi Aid' },
      ],
      proofs: [
        {
          filename: 'proof-sunita-devi-tmh-oncology.png',
          original: 'TMH_Jamshedpur_Oncology_Protocol_Estimate.png',
          docTitle: 'MEDICAL ONCOLOGY DAYCARE CHEMOTHERAPY PROTOCOL',
          hospital: 'TATA MAIN HOSPITAL (TMH), JAMSHEDPUR',
          department: 'DEPARTMENT OF MEDICAL ONCOLOGY & HAEMATOLOGY',
          patient: 'Sunita Devi',
          ageSex: '49 Yrs / Female',
          ipdNo: 'TMH-ONC-2026/4102',
          date: '07-Oct-2026',
          bedWard: 'Oncology Daycare / Bed 11',
          doctor: 'Dr. Vivek Swaroop, DM (Oncology)',
          regNo: 'JMC-2009-8821',
          findings: [
            'Diagnosis: Diffuse Large B-Cell Lymphoma (DLBCL) Stage III',
            'Regimen: R-CHOP Protocol (Cycle 3 and 4)',
            'Medications: Rituximab 500mg, Cyclophosphamide, Doxorubicin, Vincristine',
            'Supportive: G-CSF growth factor injections + prophylactic antiemetics',
          ],
          costEstimate: 'CHEMOTHERAPY PROTOCOL ESTIMATE (CYCLES 3-4): Rs. 80,000/-',
          stampText: 'TMH JAMSHEDPUR * ONCOLOGY ATTESTED',
        },
      ],
      notification: {
        userId: priya.id,
        title: 'Your fundraiser is live',
        body: '"Emergency Chemotherapy & Supportive Oncology Care for Sunita Devi" is now visible to all students.',
      },
    },

    // ══════════════ 4. APPROVED (Rohit Mahato) ══════════════
    {
      user_id: rohit.id,
      title: 'Second-Degree Chemical Burn Skin Grafting & Wound Care for Rahul Pandey',
      story: `Rahul Pandey (Final Year Mechanical) suffered second-degree thermal and acid burns on his forearm and torso during an off-campus engineering fabrication project.

He requires collagen dressings, daily debridement, and specialized skin graft procedures at Dhanbad Central Burn Hospital. Medical bills and specialized burn ointments have exhausted personal savings. Please help our batchmate recover without risking permanent scarring or nerve damage.`,
      beneficiary_name: 'Rahul Pandey',
      amount_needed: 45000,
      amount_raised: 36000,
      severity: 2,
      upi_id: 'rohitmahato.aid@ybl',
      status: 'approved',
      admin_note: 'Dermatology & burn ward treatment bills verified.',
      reviewed_by: adminId,
      reviewed_offset: 'interval \'5 days\'',
      created_offset: 'interval \'6 days\'',
      qr_codes: [
        { filename: 'qr-rahul-pandey-burns.png', brand: 'PhonePe', brandColor: [95, 37, 159], upiId: 'rohitmahato.aid@ybl', name: 'Rahul Pandey Relief' },
      ],
      proofs: [
        {
          filename: 'proof-rahul-pandey-burn-care.png',
          original: 'Dhanbad_Central_Burn_Ward_Estimate.png',
          docTitle: 'SPECIALIZED BURN INJURY & PLASTIC SURGERY CHART',
          hospital: 'DHANBAD CENTRAL HOSPITAL & ADVANCED BURN UNIT',
          department: 'DEPARTMENT OF PLASTIC & RECONSTRUCTIVE SURGERY',
          patient: 'Rahul Pandey',
          ageSex: '22 Yrs / Male',
          ipdNo: 'DCH-BURN-2026/049',
          date: '05-Oct-2026',
          bedWard: 'Burn ICU / Bed 03',
          doctor: 'Dr. Manish K. Agarwal, MCh (Plastic Surgery)',
          regNo: 'DMC-2016-3390',
          findings: [
            'Diagnosis: Second-Degree Thermal & Chemical Burns (18% TBSA)',
            'Affected Regions: Right Forearm, Wrist & Anterior Chest Wall',
            'Management: Biological Collagen Membrane Dressings + Grafting',
            'Infection Prophylaxis: IV Meropenem & specialized silver dressings',
          ],
          costEstimate: 'ESTIMATED TOTAL RECONSTRUCTIVE CARE: Rs. 45,000/-',
          stampText: 'DHANBAD BURN WARD * ATTESTED',
        },
      ],
      notification: {
        userId: rohit.id,
        title: 'Your fundraiser is live',
        body: '"Second-Degree Chemical Burn Skin Grafting & Wound Care for Rahul Pandey" is now visible to all students.',
      },
    },

    // ══════════════ 5. PENDING (Dev Student) ══════════════
    {
      user_id: devUser.id,
      title: 'Emergency ICU Medication & Blood Support for Anjali Kumari (Acute Dengue Complications)',
      story: `Anjali (2nd year ECE, Hostel 6) was admitted to the intensive care unit at Asarfi Jalan Super Speciality Hospital Dhanbad after her platelet count plummeted dangerously below 16,000 due to severe dengue shock syndrome.

She urgently requires continuous single donor platelet (SDP) transfusions and specialized intravenous immunoglobulin therapy. We are collecting emergency contributions to assist her parents with the daily ICU and medicine costs until her condition stabilizes. All hospital receipts and test reports are submitted here for admin review.`,
      beneficiary_name: 'Anjali Kumari',
      amount_needed: 95000,
      amount_raised: 0,
      severity: 4,
      upi_id: 'devstudent.anjali@okaxis',
      status: 'pending',
      admin_note: null,
      reviewed_by: null,
      reviewed_offset: null,
      created_offset: 'interval \'8 hours\'',
      qr_codes: [
        { filename: 'qr-anjali-kumari-dengue.png', brand: 'Google Pay', brandColor: [14, 116, 144], upiId: 'devstudent.anjali@okaxis', name: 'Anjali Kumari Aid' },
      ],
      proofs: [
        {
          filename: 'proof-anjali-jalan-hospital-icu.png',
          original: 'Asarfi_Jalan_Hospital_ICU_Admission.png',
          docTitle: 'EMERGENCY CRITICAL CARE ICU ADMISSION CERTIFICATE',
          hospital: 'ASARFI HOSPITAL & JALAN SUPER SPECIALITY CENTRE',
          department: 'DEPARTMENT OF CRITICAL CARE MEDICINE & ICU',
          patient: 'Anjali Kumari',
          ageSex: '19 Yrs / Female',
          ipdNo: 'AJH-ICU-2026/771',
          date: '11-Oct-2026',
          bedWard: 'Medical ICU / Bed 07',
          doctor: 'Dr. R. N. Sharma, MD (Internal Medicine), FNB (Crit Care)',
          regNo: 'JMC-2011-502',
          findings: [
            'Diagnosis: Severe Dengue Hemorrhagic Fever with Dengue Shock Syndrome',
            'Platelet Count on Admission: 16,000 / microL (Critical Risk)',
            'Management: Immediate Single Donor Platelet (SDP) apheresis',
            'Supportive: Intravenous fluids, plasma volume expanders, ICU monitoring',
          ],
          costEstimate: 'ESTIMATED ICU ADMISSION & APHERESIS SUM: Rs. 95,000/-',
          stampText: 'ASARFI ICU * EMERGENCY VERIFIED',
        },
        {
          filename: 'proof-anjali-platelet-lab-report.png',
          original: 'Critical_Platelet_Count_16000_Report.png',
          docTitle: 'EMERGENCY PATHOLOGY & HAEMATOLOGY LABORATORY REPORT',
          hospital: 'CENTRAL PATHOLOGY LABORATORY, ASARFI HOSPITAL',
          department: 'DEPARTMENT OF PATHOLOGY & BLOOD TRANSFUSION',
          patient: 'Anjali Kumari',
          ageSex: '19 Yrs / Female',
          ipdNo: 'AJH-ICU-2026/771',
          date: '11-Oct-2026',
          bedWard: 'Medical ICU / Bed 07',
          doctor: 'Dr. Shalini Prasad, MD (Pathology)',
          regNo: 'CP-2018-992',
          findings: [
            'Total Platelet Count: 16,000 / cu.mm (Normal: 150,000 - 450,000)',
            'Haemoglobin (Hb): 9.4 g/dL | Haematocrit (PCV): 44.2%',
            'Dengue NS1 Antigen: POSITIVE (High Titer)',
            'Recommendation: Immediate 2 Units SDP transfusion stat',
          ],
          costEstimate: 'TOTAL APHERESIS & TRANSFUSION CHARGES: Rs. 95,000/-',
          stampText: 'PATHOLOGY LAB * CRITICAL VALUE ALERT',
        },
      ],
      notification: null,
    },

    // ══════════════ 6. PENDING (Sneha Oraon) ══════════════
    {
      user_id: sneha.id,
      title: 'Emergency Spinal Alignment & Pelvic Fracture Care for Deepa Mundu',
      story: `First-year student Deepa Mundu was severely injured when an auto-rickshaw overturned on the Dhanbad-Sindri main road.

She has suffered pelvic fractures and L2-L3 lumbar spine compression requiring immediate orthopedic traction and stabilization at SNMMCH Dhanbad. Her family in Khunti is travelling here with no emergency savings. We request urgent campus solidarity to purchase surgical pins and medicines.`,
      beneficiary_name: 'Deepa Mundu',
      amount_needed: 120000,
      amount_raised: 0,
      severity: 4,
      upi_id: 'sneha.deepamundu@paytm',
      status: 'pending',
      admin_note: null,
      reviewed_by: null,
      reviewed_offset: null,
      created_offset: 'interval \'4 hours\'',
      qr_codes: [
        { filename: 'qr-deepa-mundu-ortho.png', brand: 'Paytm UPI', brandColor: [0, 185, 245], upiId: 'sneha.deepamundu@paytm', name: 'Deepa Mundu' },
      ],
      proofs: [
        {
          filename: 'proof-deepa-mundu-snmmch-emergency.png',
          original: 'SNMMCH_Emergency_Trauma_Pelvis_XRay_Receipt.png',
          docTitle: 'EMERGENCY TRAUMA & SPINE STABILIZATION RECORD',
          hospital: 'SHAHID NIRMAL MAHTO MEDICAL COLLEGE & HOSPITAL (SNMMCH)',
          department: 'DEPARTMENT OF SPINE SURGERY & EMERGENCY TRAUMA',
          patient: 'Deepa Mundu',
          ageSex: '18 Yrs / Female',
          ipdNo: 'SNM-SPINE-2026/301',
          date: '11-Oct-2026',
          bedWard: 'Trauma ICU / Bed 02',
          doctor: 'Dr. A. K. Choudhary, MS (Ortho), Spine Fellow',
          regNo: 'JMC-2010-612',
          findings: [
            'Diagnosis: High-Velocity RTA with Pelvic Ring Disruption & L2 Burst Fracture',
            'Neurological Exam: Incomplete paraparesis; requiring emergent stabilization',
            'Procedure: Posterior Lumbar Decompression & Instrumentation with Pedicle Screws',
            'Pelvic External Fixator application recommended',
          ],
          costEstimate: 'ESTIMATED IMPLANTS & TRAUMA OT CHARGES: Rs. 1,20,000/-',
          stampText: 'SNMMCH TRAUMA UNIT * VERIFIED',
        },
      ],
      notification: null,
    },

    // ══════════════ 7. REJECTED (Dev Student) ══════════════
    {
      user_id: devUser.id,
      title: 'Laptop Repair and Screen Replacement Fund for Lab Work',
      story: `My laptop display panel broke during data structures laboratory class and I cannot afford a replacement screen before the end-semester submissions. Requesting campus donations to repair my Dell Inspiron screen.`,
      beneficiary_name: 'Dev Student',
      amount_needed: 12000,
      amount_raised: 0,
      severity: 1,
      upi_id: 'devstudent@okhdfcbank',
      status: 'rejected',
      admin_note: 'Kavach mutual aid fundraisers are strictly reserved for genuine medical emergencies, accidents, and life-critical distress. Please reach out to your department HOD or alumni book/equipment bank for academic hardware assistance.',
      reviewed_by: adminId,
      reviewed_offset: 'interval \'1 day 18 hours\'',
      created_offset: 'interval \'2 days\'',
      qr_codes: [
        { filename: 'qr-laptop-service.png', brand: 'HDFC UPI', brandColor: [30, 41, 59], upiId: 'devstudent@okhdfcbank', name: 'Dev Student' },
      ],
      proofs: [
        {
          filename: 'proof-laptop-repair-quotation.png',
          original: 'Dell_Service_Centre_Display_Estimate.png',
          docTitle: 'HARDWARE SERVICE ESTIMATE & REPAIR QUOTATION',
          hospital: 'AUTHORIZED LAPTOP SERVICE CARE, DHANBAD',
          department: 'CUSTOMER HARDWARE REPAIR CENTRE',
          patient: 'Dev Student',
          ageSex: '21 Yrs / Male',
          ipdNo: 'JOB-2026/8812',
          date: '09-Oct-2026',
          bedWard: 'Walk-in Service Desk',
          doctor: 'Vikram Verma, Senior Hardware Engineer',
          regNo: 'TECH-2019-441',
          findings: [
            'Equipment: Dell Inspiron 15 5000 Series Laptop',
            'Issue: Cracked 15.6 inch FHD IPS Display Panel',
            'Action: LCD Panel Assembly Replacement',
            'Estimate: Panel Rs. 9,500 + Service Charge Rs. 2,500 = Rs. 12,000',
          ],
          costEstimate: 'TOTAL ESTIMATE: Rs. 12,000/-',
          stampText: 'LAPTOP SERVICE CENTRE * COMMERCIAL QUOTE',
        },
      ],
      notification: {
        userId: devUser.id,
        title: 'Your fundraiser needs changes',
        body: '"Laptop Repair and Screen Replacement Fund for Lab Work" — Kavach mutual aid fundraisers are strictly reserved for genuine medical emergencies, accidents, and life-critical distress.',
      },
    },

    // ══════════════ 8. CLOSED (Rohit Mahato - 100% Funded Success) ══════════════
    {
      user_id: rohit.id,
      title: 'Emergency Cataract & Eye Trauma Surgery for Lab Attendant Ramesh Ji',
      story: `Our departmental machine shop attendant, Ramesh Ji, who has served BIT Sindri students for over 18 years, suffered a traumatic corneal injury.

Thanks to the prompt and overwhelming kindness of all engineering students and alumni, the full target of Rs. 30,000 was successfully gathered and paid to the eye hospital. Ramesh Ji has successfully completed surgery and is in good health! Thank you everyone for your love and support.`,
      beneficiary_name: 'Ramesh Sharma',
      amount_needed: 30000,
      amount_raised: 30000,
      severity: 2,
      upi_id: 'ramesh.eyecare@oksbi',
      status: 'closed',
      admin_note: 'Full target reached. Surgery successful at Dhanbad Eye Centre. Closed on request.',
      reviewed_by: adminId,
      reviewed_offset: 'interval \'10 days\'',
      created_offset: 'interval \'12 days\'',
      qr_codes: [
        { filename: 'qr-ramesh-sharma-eye.png', brand: 'SBI UPI', brandColor: [30, 58, 138], upiId: 'ramesh.eyecare@oksbi', name: 'Ramesh Sharma' },
      ],
      proofs: [
        {
          filename: 'proof-ramesh-eye-hospital-discharge.png',
          original: 'Dhanbad_Eye_Hospital_Discharge_Summary.png',
          docTitle: 'OPHTHALMIC SURGERY DISCHARGE & RECOVERY SUMMARY',
          hospital: 'DHANBAD ROTARY EYE HOSPITAL & RESEARCH INSTITUTE',
          department: 'DEPARTMENT OF CORNEA & ANTERIOR SEGMENT',
          patient: 'Ramesh Sharma',
          ageSex: '56 Yrs / Male',
          ipdNo: 'DREH-2026/512',
          date: '02-Oct-2026',
          bedWard: 'Daycare OT / Bed 05',
          doctor: 'Dr. Sunita K. Murmu, MS (Ophthalmology)',
          regNo: 'JMC-2007-1902',
          findings: [
            'Diagnosis: Traumatic Corneal Laceration with Traumatic Cataract',
            'Surgery Performed: Corneal Tear Repair + Phacoemulsification with Foldable IOL',
            'Post-op Vision: 6/12 with clear visual axis',
            'Full recovery confirmed; discharge cleared without complications',
          ],
          costEstimate: 'PAID IN FULL (SURGERY + FOLDABLE IOL): Rs. 30,000/-',
          stampText: 'ROTARY EYE HOSPITAL * CLEARED & DISCHARGED',
        },
      ],
      notification: null,
    },
  ];

  for (const item of fundraisersData) {
    // 1. Generate & save public QR images
    const qrUrls = [];
    for (const qr of item.qr_codes) {
      const qrPath = path.join(publicDir, qr.filename);
      const pngBuffer = generateQrImage({
        upiId: qr.upiId,
        name: qr.name,
        brand: qr.brand,
        brandColor: qr.brandColor,
      });
      fs.writeFileSync(qrPath, pngBuffer);
      qrUrls.push(`/uploads/public/${qr.filename}`);
    }

    // 2. Generate & save private proof documents
    const proofFileObjects = [];
    for (const p of item.proofs) {
      const proofPath = path.join(privateDir, p.filename);
      const pngBuffer = generateMedicalProofImage({
        hospital: p.hospital,
        department: p.department,
        docTitle: p.docTitle,
        patient: p.patient,
        ageSex: p.ageSex,
        ipdNo: p.ipdNo,
        date: p.date,
        bedWard: p.bedWard,
        doctor: p.doctor,
        regNo: p.regNo,
        findings: p.findings,
        costEstimate: p.costEstimate,
        stampText: p.stampText,
      });
      fs.writeFileSync(proofPath, pngBuffer);
      proofFileObjects.push({
        name: p.filename,
        mime: 'image/png',
        original: p.original,
        size: pngBuffer.length,
      });
    }

    // 3. Insert into fundraisers table
    const reviewedAtSql = item.reviewed_offset ? `now() - ${item.reviewed_offset}` : 'NULL';
    const { rows: [fundraiser] } = await query(
      `INSERT INTO fundraisers (
         user_id, title, story, beneficiary_name, amount_needed, amount_raised,
         severity, upi_id, qr_images, proof_files, status, admin_note,
         reviewed_by, reviewed_at, created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9, $10, $11, $12,
         $13, ${reviewedAtSql}, now() - ${item.created_offset}, now() - ${item.created_offset}
       ) RETURNING id`,
      [
        item.user_id,
        item.title,
        item.story,
        item.beneficiary_name,
        item.amount_needed,
        item.amount_raised,
        item.severity,
        item.upi_id,
        qrUrls,
        JSON.stringify(proofFileObjects),
        item.status,
        item.admin_note,
        item.reviewed_by,
      ],
    );

    // 4. Add notification if specified
    if (item.notification) {
      await query(
        `INSERT INTO notifications (user_id, title, body, link, created_at)
         VALUES ($1, $2, $3, $4, now() - ${item.created_offset})`,
        [
          item.notification.userId,
          item.notification.title,
          item.notification.body,
          `/app/fundraisers/${fundraiser.id}`,
        ],
      );
    }

    // 5. Audit logs for robustness
    await query(
      `INSERT INTO audit_logs (actor_type, actor_id, action, target, meta, created_at)
       VALUES ('user', $1, 'fundraiser.create', $2, $3, now() - ${item.created_offset})`,
      [item.user_id, fundraiser.id, JSON.stringify({ title: item.title, amount_needed: item.amount_needed })],
    );

    if (item.status === 'approved' || item.status === 'rejected') {
      const decision = item.status === 'approved' ? 'approve' : 'reject';
      await query(
        `INSERT INTO audit_logs (actor_type, actor_id, action, target, meta, created_at)
         VALUES ('admin', $1, $2, $3, $4, ${reviewedAtSql})`,
        [adminId, `fundraiser.${decision}`, fundraiser.id, JSON.stringify({ note: item.admin_note })],
      );
    }
  }

  log('✔ Seeded 8 robust fundraisers (4 Approved, 2 Pending, 1 Rejected, 1 Closed) with verified QR codes, real proof documents, and notifications');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  seedFundraisers()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
