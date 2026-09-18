import { createHmac, timingSafeEqual } from "node:crypto";

const b64 = (value) => Buffer.from(value).toString("base64url");
const unb64 = (value) => Buffer.from(value, "base64url").toString("utf8");

export function mintCollaborationToken(secret, claims) {
  if (!secret) throw new Error("A collaboration signing secret is required.");
  const payload = b64(JSON.stringify({ v: 1, ...claims }));
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `v1.${payload}.${signature}`;
}

export function verifyCollaborationToken(secret, token) {
  if (!secret || !token?.startsWith("v1.")) return null;
  const [, payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", secret).update(payload).digest();
  let supplied;
  try { supplied = Buffer.from(signature, "base64url"); } catch { return null; }
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
  let claims;
  try { claims = JSON.parse(unb64(payload)); } catch { return null; }
  if (claims.v !== 1) return null;
  if (claims.exp && Date.now() >= Number(claims.exp) * 1000) return null;
  if (!["viewer", "editor", "admin"].includes(claims.role)) return null;
  return claims;
}

export function allowsCollaborationAccess(claims, roomId, projectId, requiredRole = "viewer") {
  if (!claims) return false;
  const rank = { viewer: 1, editor: 2, admin: 3 };
  if ((rank[claims.role] || 0) < (rank[requiredRole] || 1)) return false;
  if (claims.projectId && claims.projectId !== projectId) return false;
  if (claims.roomId && claims.roomId !== roomId) return false;
  return true;
}
