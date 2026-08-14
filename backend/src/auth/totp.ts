import { createHmac, randomBytes } from 'crypto';

/**
 * TOTP (RFC 6238) на node:crypto — без внешних зависимостей.
 * Пакет otplib@13 поставляется как ESM-only и падает в CommonJS-сборке Nest,
 * поэтому 6-значные коды считаем сами: HMAC-SHA1, шаг 30 секунд.
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_SECONDS = 30;
const DIGITS = 6;
/** Допуск на расхождение часов: ±1 шаг (30 секунд). */
const WINDOW = 1;

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, '').replace(/\s+/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) {
      throw new Error(`Invalid base32 character: ${char}`);
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** Секрет в base32 (20 байт — как у большинства аутентификаторов). */
export function generateSecret(): string {
  return base32Encode(randomBytes(20));
}

/** Код для конкретного шага времени. */
function codeFor(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  buf.writeUInt32BE(counter >>> 0, 4);

  const hmac = createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(binary % 10 ** DIGITS).padStart(DIGITS, '0');
}

/** Проверка кода с допуском ±1 шаг. */
export function verifyTotp(params: { token: string; secret: string }): {
  valid: boolean;
} {
  const token = (params.token ?? '').replace(/\D/g, '');
  if (token.length !== DIGITS || !params.secret) return { valid: false };
  const counter = Math.floor(Date.now() / 1000 / STEP_SECONDS);
  for (let drift = -WINDOW; drift <= WINDOW; drift++) {
    try {
      if (codeFor(params.secret, counter + drift) === token) {
        return { valid: true };
      }
    } catch {
      return { valid: false };
    }
  }
  return { valid: false };
}

/** otpauth-URL для QR-кода в приложении-аутентификаторе. */
export function generateURI(params: {
  secret: string;
  issuer: string;
  label: string;
}): string {
  const label = encodeURIComponent(`${params.issuer}:${params.label}`);
  const query = new URLSearchParams({
    secret: params.secret,
    issuer: params.issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${query.toString()}`;
}
