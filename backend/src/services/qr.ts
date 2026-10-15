/**
 * Generator QR Code tanpa dependency (byte mode, error correction M,
 * versi 1–10 → cukup untuk URL sampai ~210 karakter).
 *
 * Struktur dan tabel mengikuti spesifikasi ISO/IEC 18004.
 */

const ECC_CODEWORDS_PER_BLOCK_M = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const NUM_BLOCKS_M = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
const MAX_VERSION = 10;
const FORMAT_BITS_M = 0;

const at = (list: number[], index: number): number => list[index] as number;

function numRawDataModules(ver: number): number {
  let result = (16 * ver + 128) * ver + 64;

  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7) result -= 36;
  }

  return result;
}

function numDataCodewords(ver: number): number {
  return (
    Math.floor(numRawDataModules(ver) / 8) -
    at(ECC_CODEWORDS_PER_BLOCK_M, ver) * at(NUM_BLOCKS_M, ver)
  );
}

function alignmentPositions(ver: number): number[] {
  if (ver === 1) return [];

  const numAlign = Math.floor(ver / 7) + 2;
  const size = ver * 4 + 17;
  const step = Math.ceil((ver * 4 + 4) / (numAlign * 2 - 2)) * 2;

  const result = [6];
  for (let pos = size - 7; result.length < numAlign; pos -= step) {
    result.splice(1, 0, pos);
  }
  return result;
}

/* ---------- Reed-Solomon over GF(256), polynomial 0x11D ---------- */

function gfMultiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function rsDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;

  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMultiply(at(result, j), root);
      if (j + 1 < degree) result[j] = at(result, j) ^ at(result, j + 1);
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
}

function rsRemainder(data: number[], divisor: number[]): number[] {
  const result = divisor.map(() => 0);

  for (const byte of data) {
    const factor = byte ^ (result.shift() as number);
    result.push(0);
    divisor.forEach((coef, i) => {
      result[i] = at(result, i) ^ gfMultiply(coef, factor);
    });
  }
  return result;
}

function addEccAndInterleave(data: number[], ver: number): number[] {
  const numBlocks = at(NUM_BLOCKS_M, ver);
  const blockEccLen = at(ECC_CODEWORDS_PER_BLOCK_M, ver);
  const rawCodewords = Math.floor(numRawDataModules(ver) / 8);
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);

  const divisor = rsDivisor(blockEccLen);
  const blocks: number[][] = [];

  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat = data.slice(
      k,
      k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1)
    );
    k += dat.length;

    const ecc = rsRemainder(dat, divisor);
    if (i < numShortBlocks) dat.push(0);
    blocks.push(dat.concat(ecc));
  }

  const result: number[] = [];
  const firstBlock = blocks[0] as number[];

  for (let i = 0; i < firstBlock.length; i++) {
    blocks.forEach((block, j) => {
      // Slot padding pada short block dilewati.
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) {
        result.push(at(block, i));
      }
    });
  }

  return result;
}

/* ---------- Matrix ---------- */

class Matrix {
  readonly modules: Uint8Array;
  private readonly fixed: Uint8Array;

  constructor(readonly size: number) {
    this.modules = new Uint8Array(size * size);
    this.fixed = new Uint8Array(size * size);
  }

  get(x: number, y: number): number {
    return this.modules[y * this.size + x] as number;
  }

  set(x: number, y: number, dark: boolean | number) {
    this.modules[y * this.size + x] = dark ? 1 : 0;
  }

  setFunction(x: number, y: number, dark: boolean | number) {
    this.set(x, y, dark);
    this.fixed[y * this.size + x] = 1;
  }

  isFunction(x: number, y: number): boolean {
    return this.fixed[y * this.size + x] === 1;
  }
}

function drawFinder(m: Matrix, cx: number, cy: number) {
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      const x = cx + dx;
      const y = cy + dy;
      if (x >= 0 && x < m.size && y >= 0 && y < m.size) {
        m.setFunction(x, y, dist !== 2 && dist !== 4);
      }
    }
  }
}

function drawAlignment(m: Matrix, cx: number, cy: number) {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      m.setFunction(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
}

function drawFormatBits(m: Matrix, mask: number) {
  const data = (FORMAT_BITS_M << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  const bit = (i: number) => ((bits >>> i) & 1) === 1;

  for (let i = 0; i <= 5; i++) m.setFunction(8, i, bit(i));
  m.setFunction(8, 7, bit(6));
  m.setFunction(8, 8, bit(7));
  m.setFunction(7, 8, bit(8));
  for (let i = 9; i < 15; i++) m.setFunction(14 - i, 8, bit(i));

  for (let i = 0; i < 8; i++) m.setFunction(m.size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) m.setFunction(8, m.size - 15 + i, bit(i));
  m.setFunction(8, m.size - 8, true);
}

function drawVersion(m: Matrix, ver: number) {
  if (ver < 7) return;

  let rem = ver;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  const bits = (ver << 12) | rem;

  for (let i = 0; i < 18; i++) {
    const dark = ((bits >>> i) & 1) === 1;
    const a = m.size - 11 + (i % 3);
    const b = Math.floor(i / 3);
    m.setFunction(a, b, dark);
    m.setFunction(b, a, dark);
  }
}

function drawFunctionPatterns(m: Matrix, ver: number) {
  for (let i = 0; i < m.size; i++) {
    m.setFunction(6, i, i % 2 === 0);
    m.setFunction(i, 6, i % 2 === 0);
  }

  drawFinder(m, 3, 3);
  drawFinder(m, m.size - 4, 3);
  drawFinder(m, 3, m.size - 4);

  const positions = alignmentPositions(ver);
  const last = positions.length - 1;

  positions.forEach((px, i) => {
    positions.forEach((py, j) => {
      const onFinder =
        (i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0);
      if (!onFinder) drawAlignment(m, px, py);
    });
  });

  drawFormatBits(m, 0);
  drawVersion(m, ver);
}

function drawCodewords(m: Matrix, data: number[]) {
  let i = 0;

  for (let right = m.size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;

    for (let vert = 0; vert < m.size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? m.size - 1 - vert : vert;

        if (!m.isFunction(x, y) && i < data.length * 8) {
          m.set(x, y, ((at(data, i >>> 3) >>> (7 - (i & 7))) & 1) === 1);
          i++;
        }
      }
    }
  }
}

function maskApplies(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5: return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6: return ((((x * y) % 2) + ((x * y) % 3)) % 2) === 0;
    default: return ((((x + y) % 2) + ((x * y) % 3)) % 2) === 0;
  }
}

function applyMask(m: Matrix, mask: number) {
  for (let y = 0; y < m.size; y++) {
    for (let x = 0; x < m.size; x++) {
      if (!m.isFunction(x, y) && maskApplies(mask, x, y)) {
        m.set(x, y, m.get(x, y) ^ 1);
      }
    }
  }
}

const FINDER_A = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
const FINDER_B = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];

function penalty(m: Matrix): number {
  const n = m.size;
  let score = 0;

  const scanLine = (read: (k: number) => number) => {
    let run = 1;
    for (let k = 1; k < n; k++) {
      if (read(k) === read(k - 1)) {
        run++;
        if (run === 5) score += 3;
        else if (run > 5) score += 1;
      } else {
        run = 1;
      }
    }

    for (let k = 0; k + 11 <= n; k++) {
      const window = Array.from({ length: 11 }, (_, i) => read(k + i));
      if (
        window.every((v, i) => v === FINDER_A[i]) ||
        window.every((v, i) => v === FINDER_B[i])
      ) {
        score += 40;
      }
    }
  };

  for (let i = 0; i < n; i++) {
    scanLine((k) => m.get(k, i));
    scanLine((k) => m.get(i, k));
  }

  let dark = 0;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const value = m.get(x, y);
      dark += value;
      if (
        x + 1 < n &&
        y + 1 < n &&
        value === m.get(x + 1, y) &&
        value === m.get(x, y + 1) &&
        value === m.get(x + 1, y + 1)
      ) {
        score += 3;
      }
    }
  }

  const total = n * n;
  score += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;

  return score;
}

/* ---------- Public API ---------- */

export interface QrCode {
  size: number;
  version: number;
  /** modules[y][x] → true kalau gelap. */
  isDark(x: number, y: number): boolean;
}

export function encodeQr(text: string): QrCode {
  const bytes = Array.from(new TextEncoder().encode(text));

  let version = 0;
  for (let ver = 1; ver <= MAX_VERSION; ver++) {
    const countBits = ver <= 9 ? 8 : 16;
    if (4 + countBits + bytes.length * 8 <= numDataCodewords(ver) * 8) {
      version = ver;
      break;
    }
  }

  if (version === 0) {
    throw new RangeError("Teks terlalu panjang untuk QR (maks ±210 byte).");
  }

  const bits: number[] = [];
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };

  push(0b0100, 4); // byte mode
  push(bytes.length, version <= 9 ? 8 : 16);
  bytes.forEach((byte) => push(byte, 8));

  const capacityBits = numDataCodewords(version) * 8;
  push(0, Math.min(4, capacityBits - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);

  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    data.push(bits.slice(i, i + 8).reduce((acc, bit) => (acc << 1) | bit, 0));
  }
  for (let pad = 0xec; data.length < numDataCodewords(version); pad ^= 0xec ^ 0x11) {
    data.push(pad);
  }

  const m = new Matrix(version * 4 + 17);
  drawFunctionPatterns(m, version);
  drawCodewords(m, addEccAndInterleave(data, version));

  let bestMask = 0;
  let bestPenalty = Infinity;

  for (let mask = 0; mask < 8; mask++) {
    applyMask(m, mask);
    drawFormatBits(m, mask);
    const score = penalty(m);
    if (score < bestPenalty) {
      bestPenalty = score;
      bestMask = mask;
    }
    applyMask(m, mask); // XOR lagi = batalkan
  }

  applyMask(m, bestMask);
  drawFormatBits(m, bestMask);

  return {
    size: m.size,
    version,
    isDark: (x, y) => x >= 0 && y >= 0 && x < m.size && y < m.size && m.get(x, y) === 1,
  };
}

export function qrToSvg(
  text: string,
  options: { border?: number; dark?: string; light?: string } = {}
): string {
  const { border = 4, dark = "#171515", light = "#ffffff" } = options;
  const qr = encodeQr(text);
  const total = qr.size + border * 2;

  let path = "";
  for (let y = 0; y < qr.size; y++) {
    let x = 0;
    while (x < qr.size) {
      if (!qr.isDark(x, y)) {
        x++;
        continue;
      }
      const start = x;
      while (x < qr.size && qr.isDark(x, y)) x++;
      path += `M${start + border},${y + border}h${x - start}v1h-${x - start}z`;
    }
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" ` +
    `shape-rendering="crispEdges" role="img" aria-label="QR code">` +
    `<rect width="${total}" height="${total}" fill="${light}"/>` +
    `<path d="${path}" fill="${dark}"/></svg>`
  );
}
