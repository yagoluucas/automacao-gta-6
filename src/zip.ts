import { inflateRawSync } from "node:zlib";

const MAX_ARCHIVE = 60 * 1024 * 1024;
const MAX_ENTRY = 35 * 1024 * 1024;
const MAX_TOTAL = 125 * 1024 * 1024;
const MAX_ENTRIES = 40;
const EOCD = 0x06054b50;
const CD = 0x02014b50;
const LOCAL = 0x04034b50;

const crcTable = Uint32Array.from({ length: 256 }, (_, i) => {
  let n = i;
  for (let j = 0; j < 8; j++) n = (n & 1) ? (0xedb88320 ^ (n >>> 1)) : (n >>> 1);
  return n >>> 0;
});

export function crc32(data: Buffer): number {
  let value = 0xffffffff;
  for (const byte of data) value = crcTable[(value ^ byte) & 0xff]! ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function requireRange(buf: Buffer, start: number, bytes: number): void {
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(bytes) || start < 0 || bytes < 0 || start + bytes > buf.length) {
    throw new Error("ZIP truncado ou com deslocamentos inválidos");
  }
}

function safeName(name: string): void {
  const parts = name.split("/");
  if (!name || name.includes("\\") || name.includes("\0") || name.startsWith("/") || /^[a-z]:/i.test(name) || parts.some((p) => p === ".." || p === "." || p === "")) {
    throw new Error(`Caminho não permitido dentro do ZIP: ${JSON.stringify(name)}`);
  }
}

/** Lê ZIP padrão (sem ZIP64), verifica CRC e impõe limites antes de descomprimir. Não extrai nada no disco. */
export function readZip(buffer: Buffer): Map<string, Buffer> {
  if (buffer.length > MAX_ARCHIVE) throw new Error("ZIP excede o limite de 60 MB");
  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 22 - 65535); i--) {
    if (buffer.readUInt32LE(i) === EOCD && i + 22 + buffer.readUInt16LE(i + 20) === buffer.length) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error("ZIP inválido: diretório central ausente");
  if (buffer.readUInt16LE(end + 4) || buffer.readUInt16LE(end + 6)) throw new Error("ZIP dividido em volumes não suportado");
  const count = buffer.readUInt16LE(end + 10);
  const centralSize = buffer.readUInt32LE(end + 12);
  const centralOffset = buffer.readUInt32LE(end + 16);
  if (count > MAX_ENTRIES) throw new Error("ZIP contém arquivos demais");
  if (count === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) {
    throw new Error("ZIP64 não suportado no leitor inicial");
  }
  requireRange(buffer, centralOffset, centralSize);
  if (centralOffset + centralSize > end) throw new Error("Diretório central inválido");

  const files = new Map<string, Buffer>();
  let offset = centralOffset;
  let total = 0;
  const decoder = new TextDecoder("utf-8", { fatal: true });
  for (let index = 0; index < count; index++) {
    requireRange(buffer, offset, 46);
    if (buffer.readUInt32LE(offset) !== CD) throw new Error("Assinatura do diretório central inválida");
    const flags = buffer.readUInt16LE(offset + 8);
    const method = buffer.readUInt16LE(offset + 10);
    const expectedCrc = buffer.readUInt32LE(offset + 16);
    const packedSize = buffer.readUInt32LE(offset + 20);
    const outputSize = buffer.readUInt32LE(offset + 24);
    const nameLen = buffer.readUInt16LE(offset + 28);
    const extraLen = buffer.readUInt16LE(offset + 30);
    const commentLen = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    requireRange(buffer, offset, 46 + nameLen + extraLen + commentLen);
    const name = decoder.decode(buffer.subarray(offset + 46, offset + 46 + nameLen));
    safeName(name);
    offset += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith("/")) continue;
    if (files.has(name)) throw new Error(`Entrada duplicada no ZIP: ${name}`);
    if (flags & 1) throw new Error("ZIP criptografado não suportado");
    if (method !== 0 && method !== 8) throw new Error(`Compressão não suportada: ${name}`);
    if (packedSize > MAX_ARCHIVE || outputSize > MAX_ENTRY || total + outputSize > MAX_TOTAL) {
      throw new Error(`Limite de descompressão excedido: ${name}`);
    }
    requireRange(buffer, localOffset, 30);
    if (buffer.readUInt32LE(localOffset) !== LOCAL) throw new Error("Cabeçalho local do ZIP inválido");
    const start = localOffset + 30 + buffer.readUInt16LE(localOffset + 26) + buffer.readUInt16LE(localOffset + 28);
    requireRange(buffer, start, packedSize);
    if (start + packedSize > centralOffset) throw new Error("Entrada ultrapassa o início do diretório central");
    const packed = buffer.subarray(start, start + packedSize);
    const content = method === 0 ? Buffer.from(packed) : inflateRawSync(packed, { maxOutputLength: MAX_ENTRY });
    if (content.length !== outputSize) throw new Error(`Tamanho descomprimido incorreto: ${name}`);
    if (crc32(content) !== expectedCrc) throw new Error(`CRC inválido: ${name}`);
    total += content.length;
    files.set(name, content);
  }
  if (offset !== centralOffset + centralSize) throw new Error("Tamanho do diretório central não corresponde às entradas");
  return files;
}

export function inspectPng(bytes: Buffer): { width: number; height: number } {
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) || bytes.toString("ascii", 12, 16) !== "IHDR") {
    throw new Error("Mídia não possui cabeçalho PNG válido");
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width !== 1080 || height !== 1350) throw new Error(`Dimensões inesperadas: ${width}x${height} (esperado 1080x1350)`);
  return { width, height };
}
