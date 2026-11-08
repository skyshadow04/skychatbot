import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "skychat-session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export function authIsConfigured() {
  return Boolean(
    process.env.SKYCHAT_PASSWORD && process.env.SKYCHAT_SESSION_SECRET,
  );
}

export function verifyPassword(candidate: string) {
  const expected = process.env.SKYCHAT_PASSWORD;
  if (!expected) return false;

  const candidateHash = createHash("sha256").update(candidate).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(candidateHash, expectedHash);
}

export function createSessionToken() {
  const secret = process.env.SKYCHAT_SESSION_SECRET;
  if (!secret) throw new Error("SKYCHAT_SESSION_SECRET is not configured.");

  return createHmac("sha256", secret)
    .update("skychat-session-v1")
    .digest("base64url");
}

export function isValidSession(token: string | undefined) {
  if (!token || !authIsConfigured()) return false;
  const expectedHash = createHash("sha256").update(createSessionToken()).digest();
  const tokenHash = createHash("sha256").update(token).digest();
  return timingSafeEqual(tokenHash, expectedHash);
}
