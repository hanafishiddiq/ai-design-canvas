import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export interface RequestGuardOptions {
  scope: string;
  maxRequests: number;
  windowMs: number;
  maxBodyBytes?: number;
  tokenEnv?: string;
  allowOriginsEnv?: string;
  requireTokenWithoutOrigin?: boolean;
}

interface Bucket { count: number; resetAt: number }
const buckets = new Map<string, Bucket>();

function bearer(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  if (authorization.startsWith("Bearer ")) return authorization.slice(7);
  return request.headers.get("x-adc-token") || "";
}
function secureEqual(a: string, b: string) {
  if (!a || !b) return false;
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
function configuredOrigins(envName?: string) {
  if (!envName) return [];
  return (process.env[envName] || "").split(",").map((value) => value.trim()).filter(Boolean);
}
function clientIp(request: NextRequest) {
  return (request.headers.get("x-forwarded-for") || "").split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
}
export function originAllowed(request: NextRequest, allowOriginsEnv?: string) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  if (origin === request.nextUrl.origin) return true;
  const allow = configuredOrigins(allowOriginsEnv);
  return allow.includes("*") || allow.includes(origin);
}
export function corsHeaders(request: NextRequest, allowOriginsEnv?: string) {
  const origin = request.headers.get("origin");
  const allowed = origin && originAllowed(request, allowOriginsEnv) ? origin : "";
  return {
    ...(allowed ? { "access-control-allow-origin": allowed, vary: "Origin" } : {}),
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "authorization, content-type, x-adc-token",
    "access-control-max-age": "86400",
  };
}
function rateLimit(request: NextRequest, options: RequestGuardOptions) {
  const now = Date.now(), key = `${options.scope}:${clientIp(request)}`;
  const existing = buckets.get(key);
  const bucket = !existing || now >= existing.resetAt ? { count: 0, resetAt: now + options.windowMs } : existing;
  bucket.count += 1; buckets.set(key, bucket);
  if (buckets.size > 5000) {
    for (const [candidate, value] of buckets) if (now >= value.resetAt) buckets.delete(candidate);
  }
  return {
    allowed: bucket.count <= options.maxRequests,
    remaining: Math.max(0, options.maxRequests - bucket.count),
    resetAt: bucket.resetAt,
  };
}

export function guardRequest(request: NextRequest, options: RequestGuardOptions): NextResponse | null {
  const length = Number(request.headers.get("content-length") || 0);
  if (options.maxBodyBytes && length > options.maxBodyBytes) {
    return NextResponse.json({ error: "request_too_large" }, { status: 413, headers: { "cache-control": "no-store" } });
  }

  const configuredToken = options.tokenEnv ? process.env[options.tokenEnv] || "" : "";
  const tokenAuthorized = configuredToken ? secureEqual(bearer(request), configuredToken) : false;
  const sameOrAllowedOrigin = originAllowed(request, options.allowOriginsEnv);
  const hasOrigin = Boolean(request.headers.get("origin"));

  if (!sameOrAllowedOrigin && !tokenAuthorized) {
    if (hasOrigin || options.requireTokenWithoutOrigin || configuredToken) {
      return NextResponse.json({ error: "forbidden_origin_or_token" }, { status: 403, headers: { "cache-control": "no-store" } });
    }
  }

  const limit = rateLimit(request, options);
  if (!limit.allowed) {
    const retryAfter = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000));
    return NextResponse.json({ error: "rate_limited", retryAfter }, {
      status: 429,
      headers: { "retry-after": String(retryAfter), "cache-control": "no-store" },
    });
  }
  return null;
}

export function clearRateLimitsForTests() { buckets.clear(); }
