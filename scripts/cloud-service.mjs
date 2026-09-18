import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const HOST = process.env.ADC_CLOUD_HOST || "127.0.0.1";
const PORT = Number(process.env.ADC_CLOUD_PORT || 8790);
const STATE_FILE = resolve(process.env.ADC_CLOUD_STATE_FILE || ".adc-cloud/state.json");
const SECRET = process.env.ADC_CLOUD_SECRET || randomBytes(32).toString("hex");
const ALLOW_REGISTRATION = process.env.ADC_CLOUD_ALLOW_REGISTRATION === "true";
const ALLOW_ORIGINS = (process.env.ADC_CLOUD_ALLOW_ORIGIN || "http://localhost:3000").split(",").map((value) => value.trim()).filter(Boolean);
const SESSION_HOURS = Number(process.env.ADC_CLOUD_SESSION_HOURS || 168);
const MAX_BODY_BYTES = Number(process.env.ADC_CLOUD_MAX_BODY_BYTES || 16_000_000);
const loginAttempts = new Map();
const state = { version: 1, users: [], projects: [] };

const now = () => new Date().toISOString();
const id = (prefix) => `${prefix}_${Date.now().toString(36)}_${randomBytes(5).toString("hex")}`;
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const roleRank = { viewer: 1, editor: 2, owner: 3 };
const originAllowed = (origin) => !origin || ALLOW_ORIGINS.includes("*") || ALLOW_ORIGINS.includes(origin);
const corsHeaders = (req) => ({
  "access-control-allow-origin": originAllowed(req.headers.origin) ? (req.headers.origin || ALLOW_ORIGINS[0] || "null") : "null",
  "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
  "access-control-allow-headers": "authorization,content-type",
  "access-control-max-age": "86400",
  "cache-control": "no-store",
  vary: "Origin",
});
const json = (req, res, status, body, extra = {}) => {
  res.writeHead(status, { ...corsHeaders(req), "content-type": "application/json; charset=utf-8", ...extra });
  res.end(JSON.stringify(body));
};
const safeUser = (user) => ({ id: user.id, email: user.email, name: user.name, createdAt: user.createdAt });
const activity = (project, user, action, detail = "") => {
  project.activity ||= [];
  project.activity.unshift({ id: id("evt"), userId: user.id, userName: user.name, action, detail, createdAt: now(), revision: project.revision });
  project.activity = project.activity.slice(0, 300);
};

async function loadState() {
  try {
    const parsed = JSON.parse(await readFile(STATE_FILE, "utf8"));
    if (parsed?.version === 1 && Array.isArray(parsed.users) && Array.isArray(parsed.projects)) Object.assign(state, parsed);
  } catch { /* first boot */ }
}
async function persist() {
  await mkdir(dirname(STATE_FILE), { recursive: true });
  const temp = `${STATE_FILE}.tmp`;
  await writeFile(temp, JSON.stringify(state), { mode: 0o600 });
  await rename(temp, STATE_FILE);
}
async function readBody(req) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > MAX_BODY_BYTES) throw Object.assign(new Error("Request body too large."), { status: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw Object.assign(new Error("Invalid JSON."), { status: 400 }); }
}
async function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const derived = await scrypt(password, salt, 64);
  return { salt, hash: Buffer.from(derived).toString("hex") };
}
async function passwordMatches(password, user) {
  const candidate = await hashPassword(password, user.passwordSalt);
  const a = Buffer.from(candidate.hash, "hex");
  const b = Buffer.from(user.passwordHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
function signSession(user) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const claims = { v: 1, sub: user.id, email: user.email, name: user.name, iat: issuedAt, exp: issuedAt + Math.round(SESSION_HOURS * 3600) };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signature = createHmac("sha256", SECRET).update(payload).digest("base64url");
  return { token: `adc1.${payload}.${signature}`, expiresAt: new Date(claims.exp * 1000).toISOString() };
}
function verifySession(token) {
  if (!token?.startsWith("adc1.")) return null;
  const [, payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", SECRET).update(payload).digest();
  let supplied;
  try { supplied = Buffer.from(signature, "base64url"); } catch { return null; }
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
  let claims;
  try { claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); } catch { return null; }
  if (claims.v !== 1 || !claims.sub || Date.now() >= Number(claims.exp || 0) * 1000) return null;
  return claims;
}
function authUser(req) {
  const authorization = String(req.headers.authorization || "");
  const claims = verifySession(authorization.startsWith("Bearer ") ? authorization.slice(7) : "");
  if (!claims) return null;
  return state.users.find((user) => user.id === claims.sub) || null;
}
function projectRole(project, userId) {
  if (project.ownerId === userId) return "owner";
  return project.members?.[userId] || null;
}
function requireProject(req, res, projectId, user, minimum = "viewer") {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) { json(req, res, 404, { error: "project_not_found" }); return null; }
  const role = projectRole(project, user.id);
  if (!role || roleRank[role] < roleRank[minimum]) { json(req, res, 403, { error: "forbidden", requiredRole: minimum }); return null; }
  return { project, role };
}
function summary(project, userId) {
  return {
    id: project.id,
    name: project.name,
    ownerId: project.ownerId,
    role: projectRole(project, userId),
    revision: project.revision,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    schemaVersion: project.project?.version,
    members: 1 + Object.keys(project.members || {}).length,
  };
}
function loginRateKey(req, email) { return `${req.socket.remoteAddress || "unknown"}:${email}`; }
function loginAllowed(req, email) {
  const key = loginRateKey(req, email);
  const entry = loginAttempts.get(key);
  if (!entry || Date.now() - entry.startedAt > 15 * 60_000) { loginAttempts.set(key, { count: 0, startedAt: Date.now() }); return true; }
  return entry.count < 10;
}
function recordLoginFailure(req, email) {
  const key = loginRateKey(req, email);
  const entry = loginAttempts.get(key) || { count: 0, startedAt: Date.now() };
  entry.count += 1;
  loginAttempts.set(key, entry);
}
function clearLoginFailures(req, email) { loginAttempts.delete(loginRateKey(req, email)); }

await loadState();
if (!process.env.ADC_CLOUD_SECRET) console.warn("ADC_CLOUD_SECRET is not set; generated an ephemeral session secret. Set a durable secret before production use.");

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  if (req.method === "OPTIONS") {
    if (!originAllowed(req.headers.origin)) return json(req, res, 403, { error: "origin_not_allowed" });
    res.writeHead(204, corsHeaders(req)); return res.end();
  }
  if (!originAllowed(req.headers.origin)) return json(req, res, 403, { error: "origin_not_allowed" });

  try {
    if (req.method === "GET" && url.pathname === "/health") {
      return json(req, res, 200, { ok: true, service: "ai-design-canvas-cloud", registrationAllowed: ALLOW_REGISTRATION || state.users.length === 0, users: state.users.length, projects: state.projects.length });
    }

    if (req.method === "POST" && url.pathname === "/auth/register") {
      if (!ALLOW_REGISTRATION && state.users.length > 0) return json(req, res, 403, { error: "registration_disabled" });
      const body = await readBody(req);
      const email = normalizeEmail(body.email);
      const name = String(body.name || "").trim();
      const password = String(body.password || "");
      if (!/^\S+@\S+\.\S+$/.test(email) || name.length < 2 || password.length < 12) return json(req, res, 400, { error: "invalid_registration", message: "Use a valid email, a name, and a password of at least 12 characters." });
      if (state.users.some((user) => user.email === email)) return json(req, res, 409, { error: "email_exists" });
      const passwordRecord = await hashPassword(password);
      const user = { id: id("user"), email, name, passwordSalt: passwordRecord.salt, passwordHash: passwordRecord.hash, createdAt: now() };
      state.users.push(user);
      await persist();
      return json(req, res, 201, { user: safeUser(user), ...signSession(user) });
    }

    if (req.method === "POST" && url.pathname === "/auth/login") {
      const body = await readBody(req);
      const email = normalizeEmail(body.email);
      if (!loginAllowed(req, email)) return json(req, res, 429, { error: "too_many_attempts" }, { "retry-after": "900" });
      const user = state.users.find((candidate) => candidate.email === email);
      if (!user || !(await passwordMatches(String(body.password || ""), user))) {
        recordLoginFailure(req, email);
        return json(req, res, 401, { error: "invalid_credentials" });
      }
      clearLoginFailures(req, email);
      return json(req, res, 200, { user: safeUser(user), ...signSession(user) });
    }

    const user = authUser(req);
    if (!user) return json(req, res, 401, { error: "unauthorized" });
    if (req.method === "GET" && url.pathname === "/me") return json(req, res, 200, { user: safeUser(user) });

    if (req.method === "GET" && url.pathname === "/projects") {
      return json(req, res, 200, { projects: state.projects.filter((project) => projectRole(project, user.id)).map((project) => summary(project, user.id)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) });
    }
    if (req.method === "POST" && url.pathname === "/projects") {
      const body = await readBody(req);
      const project = body.project;
      if (!project || typeof project !== "object" || !project.id || !project.name || typeof project.version !== "number") return json(req, res, 400, { error: "invalid_project" });
      if (state.projects.some((item) => item.id === project.id)) return json(req, res, 409, { error: "project_exists" });
      const timestamp = now();
      const record = { id: project.id, name: String(project.name), ownerId: user.id, members: {}, revision: 1, createdAt: timestamp, updatedAt: timestamp, project, activity: [] };
      activity(record, user, "project.created");
      state.projects.push(record);
      await persist();
      return json(req, res, 201, { project: record.project, summary: summary(record, user.id) });
    }

    const match = url.pathname.match(/^\/projects\/([^/]+)(?:\/(members|activity))?(?:\/([^/]+))?$/);
    if (match) {
      const projectId = decodeURIComponent(match[1]);
      const subresource = match[2] || "";
      const memberId = match[3] ? decodeURIComponent(match[3]) : "";
      if (!subresource) {
        if (req.method === "GET") {
          const access = requireProject(req, res, projectId, user, "viewer"); if (!access) return;
          return json(req, res, 200, { project: access.project.project, summary: summary(access.project, user.id) }, { etag: `"${access.project.revision}"` });
        }
        if (req.method === "PUT") {
          const access = requireProject(req, res, projectId, user, "editor"); if (!access) return;
          const body = await readBody(req);
          if (!body.project || body.project.id !== projectId) return json(req, res, 400, { error: "invalid_project" });
          const baseRevision = Number(body.baseRevision);
          if (!Number.isInteger(baseRevision) || baseRevision !== access.project.revision) {
            return json(req, res, 409, { error: "revision_conflict", current: summary(access.project, user.id) });
          }
          access.project.project = body.project;
          access.project.name = String(body.project.name || access.project.name);
          access.project.revision += 1;
          access.project.updatedAt = now();
          activity(access.project, user, "project.saved", `revision ${access.project.revision}`);
          await persist();
          return json(req, res, 200, { project: access.project.project, summary: summary(access.project, user.id) }, { etag: `"${access.project.revision}"` });
        }
        if (req.method === "DELETE") {
          const access = requireProject(req, res, projectId, user, "owner"); if (!access) return;
          state.projects.splice(state.projects.indexOf(access.project), 1);
          await persist();
          return json(req, res, 200, { ok: true });
        }
      }
      if (subresource === "activity" && req.method === "GET") {
        const access = requireProject(req, res, projectId, user, "viewer"); if (!access) return;
        return json(req, res, 200, { activity: access.project.activity || [] });
      }
      if (subresource === "members") {
        const access = requireProject(req, res, projectId, user, "viewer"); if (!access) return;
        if (req.method === "GET") {
          const members = [{ user: safeUser(state.users.find((item) => item.id === access.project.ownerId)), role: "owner" }, ...Object.entries(access.project.members || {}).flatMap(([userId, role]) => {
            const member = state.users.find((candidate) => candidate.id === userId);
            return member ? [{ user: safeUser(member), role }] : [];
          })];
          return json(req, res, 200, { members });
        }
        if (req.method === "POST") {
          if (access.role !== "owner") return json(req, res, 403, { error: "forbidden", requiredRole: "owner" });
          const body = await readBody(req);
          const role = String(body.role || "");
          if (!["viewer", "editor"].includes(role)) return json(req, res, 400, { error: "invalid_role" });
          const member = state.users.find((candidate) => candidate.email === normalizeEmail(body.email));
          if (!member) return json(req, res, 404, { error: "user_not_found" });
          if (member.id === access.project.ownerId) return json(req, res, 400, { error: "owner_role_is_fixed" });
          access.project.members[member.id] = role;
          access.project.updatedAt = now();
          activity(access.project, user, "member.updated", `${member.email} → ${role}`);
          await persist();
          return json(req, res, 200, { ok: true });
        }
        if (req.method === "DELETE" && memberId) {
          if (access.role !== "owner") return json(req, res, 403, { error: "forbidden", requiredRole: "owner" });
          delete access.project.members[memberId];
          access.project.updatedAt = now();
          activity(access.project, user, "member.removed", memberId);
          await persist();
          return json(req, res, 200, { ok: true });
        }
      }
    }

    return json(req, res, 404, { error: "not_found" });
  } catch (error) {
    return json(req, res, Number(error?.status || 500), { error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`AI Design Canvas cloud service listening on http://${HOST}:${PORT}`);
  console.log(`State file: ${STATE_FILE}`);
  console.log(`Allowed origins: ${ALLOW_ORIGINS.join(", ")}`);
});
