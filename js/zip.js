// Minimal ZIP reader for Blob/File input. Reads the central directory and only
// decompresses the entries asked for, so large exports don't have to fit in memory.
// Supports stored and deflated entries (what export tools produce); not ZIP64.

const td = new TextDecoder();

async function bytes(blob, start, end) {
  return new Uint8Array(await blob.slice(start, end).arrayBuffer());
}

export async function listZip(blob) {
  const tailLen = Math.min(blob.size, 65557);
  const tail = await bytes(blob, blob.size - tailLen, blob.size);
  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tail[i] === 0x50 && tail[i + 1] === 0x4b && tail[i + 2] === 0x05 && tail[i + 3] === 0x06) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Not a ZIP file');
  const dv = new DataView(tail.buffer, tail.byteOffset + eocd);
  const count = dv.getUint16(10, true);
  const cdSize = dv.getUint32(12, true);
  const cdOffset = dv.getUint32(16, true);
  if (cdOffset === 0xffffffff || count === 0xffff) throw new Error('ZIP64 archives are not supported — unpack it and import the files instead');
  const cd = await bytes(blob, cdOffset, cdOffset + cdSize);
  const view = new DataView(cd.buffer, cd.byteOffset);
  const entries = [];
  let p = 0;
  for (let i = 0; i < count; i++) {
    if (view.getUint32(p, true) !== 0x02014b50) throw new Error('Damaged ZIP directory');
    const method = view.getUint16(p + 10, true);
    const compSize = view.getUint32(p + 20, true);
    const size = view.getUint32(p + 24, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const localOffset = view.getUint32(p + 42, true);
    const name = td.decode(cd.subarray(p + 46, p + 46 + nameLen));
    if (!name.endsWith('/')) entries.push({ name, method, compSize, size, localOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

export async function readEntry(blob, entry) {
  return new Response(await entryStream(blob, entry)).text();
}

// The entry's uncompressed bytes as a stream, for entries too large for one string.
export async function entryStream(blob, entry) {
  const head = await bytes(blob, entry.localOffset, entry.localOffset + 30);
  const hv = new DataView(head.buffer, head.byteOffset);
  if (hv.getUint32(0, true) !== 0x04034b50) throw new Error(`Damaged ZIP entry ${entry.name}`);
  const start = entry.localOffset + 30 + hv.getUint16(26, true) + hv.getUint16(28, true);
  const data = blob.slice(start, start + entry.compSize);
  if (entry.method === 0) return data.stream();
  if (entry.method !== 8) throw new Error(`Unsupported compression in ${entry.name}`);
  return data.stream().pipeThrough(new DecompressionStream('deflate-raw'));
}
