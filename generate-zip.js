// Pack the app (index.html, style.css, src/*.js, decks/*.md) into nextstop-web.zip.
// Dependency-free STORE-only zip writer — run with `node generate-zip.js`.
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const outFile = path.join(root, 'nextstop-web.zip');
// Only the app files are packed — never tests, notes, or tooling in this folder.
const APP_ENTRIES = ['index.html', 'style.css', 'src', 'decks'];

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

async function collectFiles(dir) {
  const entries = [];
  async function walk(rel) {
    const abs = path.join(dir, rel);
    const st = await stat(abs);
    if (st.isDirectory()) {
      for (const name of await readdir(abs)) {
        await walk(path.join(rel, name));
      }
    } else {
      entries.push({ name: rel.split(path.sep).join('/'), data: await readFile(abs) });
    }
  }
  for (const entry of APP_ENTRIES) await walk(entry);
  return entries.sort((a, b) => (a.name < b.name ? -1 : 1));
}

/** DOS date/time packed into one 32-bit word (zip format). */
function dosDateTime() {
  const d = new Date();
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  return ((date << 16) | time) >>> 0;
}

async function zipDirectory(dir) {
  const entries = await collectFiles(dir);
  const when = dosDateTime();
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const e of entries) {
    const crc = crc32(e.data);
    const size = e.data.length;
    const nameBuf = Buffer.from(e.name, 'utf8');

    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0); // local file header signature
    lfh.writeUInt16LE(20, 4); // version needed to extract (2.0)
    lfh.writeUInt16LE(0x0800, 6); // flags: UTF-8 names
    lfh.writeUInt16LE(0, 8); // method: store
    lfh.writeUInt32LE(when, 10);
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(size, 18); // compressed size
    lfh.writeUInt32LE(size, 22); // uncompressed size
    lfh.writeUInt16LE(nameBuf.length, 26);
    lfh.writeUInt16LE(0, 28); // extra field length
    locals.push(lfh, nameBuf, e.data);

    const cdfh = Buffer.alloc(46);
    cdfh.writeUInt32LE(0x02014b50, 0); // central directory header signature
    cdfh.writeUInt16LE(20, 4); // version made by
    cdfh.writeUInt16LE(20, 6); // version needed
    cdfh.writeUInt16LE(0x0800, 8); // flags
    cdfh.writeUInt16LE(0, 10); // method
    cdfh.writeUInt32LE(when, 12);
    cdfh.writeUInt32LE(crc, 16);
    cdfh.writeUInt32LE(size, 20);
    cdfh.writeUInt32LE(size, 24);
    cdfh.writeUInt16LE(nameBuf.length, 28);
    cdfh.writeUInt16LE(0, 30); // extra length
    cdfh.writeUInt16LE(0, 32); // comment length
    cdfh.writeUInt16LE(0, 34); // disk number
    cdfh.writeUInt16LE(0, 36); // internal attrs
    cdfh.writeUInt32LE(0, 38); // external attrs
    cdfh.writeUInt32LE(offset, 42); // local header offset
    centrals.push(cdfh, nameBuf);

    offset += lfh.length + nameBuf.length + e.data.length;
  }

  const cdSize = centrals.reduce((sum, b) => sum + b.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // end of central directory signature
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // disk with central directory
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...locals, ...centrals, eocd]);
}

const zip = await zipDirectory(root);
await writeFile(outFile, zip);
console.log(`nextstop-web.zip written: ${zip.length.toLocaleString()} bytes`);
