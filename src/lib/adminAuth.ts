// Admin authentication helpers — uses Web Crypto API (edge-compatible)

export const COOKIE_NAME = 'admin_session';
export const COOKIE_MAX_AGE = 8 * 60 * 60; // 8 hours in seconds

const SESSION_VALUE = 'admin_authenticated';

async function getKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Returns a signed cookie value: "admin_authenticated.<hex_sig>" */
export async function signSession(): Promise<string> {
  const secret = process.env.ADMIN_SECRET ?? 'fallback-secret';
  const key = await getKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(SESSION_VALUE));
  return `${SESSION_VALUE}.${toHex(sig)}`;
}

/** Returns true if the cookie value is a valid signed session */
export async function verifySession(cookie: string): Promise<boolean> {
  try {
    const lastDot = cookie.lastIndexOf('.');
    if (lastDot === -1) return false;
    const value = cookie.substring(0, lastDot);
    const storedSig = cookie.substring(lastDot + 1);
    if (value !== SESSION_VALUE) return false;

    const secret = process.env.ADMIN_SECRET ?? 'fallback-secret';
    const key = await getKey(secret);
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
    return toHex(sig) === storedSig;
  } catch {
    return false;
  }
}
