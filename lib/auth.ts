// Usa la Web Crypto API (disponibile sia in Node.js che nel runtime Edge del middleware)
// così le stesse funzioni funzionano ovunque, senza dipendere dal modulo "crypto" di Node.

const COOKIE_NAME = "staff_session";
const MAX_AGE_SECONDS = 60 * 60 * 12; // 12 ore, comoda per una serata di lavoro

function getSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET mancante");
  return s;
}

async function hmacHex(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// Token semplice "scadenza.firma" firmato con HMAC — niente librerie JWT extra.
export async function createSessionToken(): Promise<string> {
  const expiry = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = String(expiry);
  const signature = await hmacHex(payload, getSecret());
  return `${payload}.${signature}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  const expected = await hmacHex(payload, getSecret());
  if (!timingSafeEqualStr(signature, expected)) return false;
  return Number(payload) > Date.now();
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
export const SESSION_MAX_AGE = MAX_AGE_SECONDS;

export function checkStaffPassword(password: string): boolean {
  const expected = process.env.STAFF_PASSWORD;
  if (!expected) throw new Error("STAFF_PASSWORD mancante");
  return timingSafeEqualStr(password, expected);
}
