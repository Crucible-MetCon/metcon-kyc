// Admin authentication helpers — uses Web Crypto API (edge-compatible)

export const COOKIE_NAME = 'admin_session';
export const COOKIE_MAX_AGE = 8 * 60 * 60; // 8 hours in seconds

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

/** Returns a signed cookie value: "admin:<username>.<hex_sig>" */
export async function signSession(username: string): Promise<string> {
  const secret = process.env.ADMIN_SECRET ?? 'fallback-secret';
  const payload = `admin:${username}`;
  const key = await getKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return `${payload}.${toHex(sig)}`;
}

/** Returns { valid, username } if the cookie value is a valid signed session */
export async function verifySession(cookie: string): Promise<{ valid: boolean; username?: string }> {
  try {
    const lastDot = cookie.lastIndexOf('.');
    if (lastDot === -1) return { valid: false };
    const payload = cookie.substring(0, lastDot);
    const storedSig = cookie.substring(lastDot + 1);

    // Accept new "admin:<username>" format and legacy "admin_authenticated"
    if (!payload.startsWith('admin:') && payload !== 'admin_authenticated') {
      return { valid: false };
    }

    const secret = process.env.ADMIN_SECRET ?? 'fallback-secret';
    const key = await getKey(secret);
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
    const valid = toHex(sig) === storedSig;

    if (!valid) return { valid: false };

    const username = payload.startsWith('admin:') ? payload.slice(6) : 'admin';
    return { valid: true, username };
  } catch {
    return { valid: false };
  }
}
