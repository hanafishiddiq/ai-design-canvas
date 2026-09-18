import { createHash } from "node:crypto";
import { allowsCollaborationAccess, verifyCollaborationToken } from "./collaboration-auth.mjs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";

const HOST = process.env.COLLAB_HOST || "0.0.0.0";
const PORT = Number(process.env.COLLAB_PORT || 8787);
const TOKEN = process.env.COLLAB_TOKEN || "";
const SECRET = process.env.COLLAB_SECRET || "";
const ALLOW_ORIGIN = process.env.COLLAB_ALLOW_ORIGIN || "*";
const DATA_DIR = process.env.COLLAB_DATA_DIR || "";
const MAX_BODY_BYTES = Number(process.env.COLLAB_MAX_BODY_BYTES || 12_000_000);
const rooms = new Map();

const headers = {
  "access-control-allow-origin": ALLOW_ORIGIN,
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "authorization,content-type",
  "cache-control": "no-store",
};
const roomKey = (roomId, projectId) => `${roomId}:${projectId}`;
const safeFile = (key) => `${createHash("sha256").update(key).digest("hex")}.json`;
const getRoom = (roomId, projectId) => {
  const key = roomKey(roomId, projectId);
  if (!rooms.has(key)) rooms.set(key, { key, roomId, projectId, clients: new Map(), presences: new Map(), snapshot: null });
  return rooms.get(key);
};
const presentedToken = (req, url) => {
  const auth = String(req.headers.authorization || "");
  if (auth.startsWith("Bearer ")) return auth.slice(7);
  return url.searchParams.get("token") || "";
};
const authenticate = (req, url) => {
  const token = presentedToken(req, url);
  if (!TOKEN && !SECRET) return { role: "admin", insecure: true };
  if (TOKEN && token === TOKEN) return { role: "admin", static: true };
  return SECRET ? verifyCollaborationToken(SECRET, token) : null;
};
const requireAccess = (res, access, roomId, projectId, role = "viewer") => {
  if (allowsCollaborationAccess(access, roomId, projectId, role)) return true;
  json(res, 403, { error: "forbidden", requiredRole: role });
  return false;
};
const json = (res, status, body) => { res.writeHead(status, { ...headers, "content-type": "application/json; charset=utf-8" }); res.end(JSON.stringify(body)); };
const sendEvent = (res, name, value) => res.write(`event: ${name}\ndata: ${JSON.stringify(value)}\n\n`);
const presenceList = (room) => [...room.presences.values()].sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
const broadcast = (room, name, value, exceptClientId) => {
  for (const [clientId, res] of room.clients) if (clientId !== exceptClientId) sendEvent(res, name, value);
};
const broadcastPresence = (room) => broadcast(room, "presence", presenceList(room));

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error("Request body too large."), { status: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw Object.assign(new Error("Invalid JSON body."), { status: 400 }); }
}

async function persistSnapshot(room) {
  if (!DATA_DIR || !room.snapshot) return;
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(join(DATA_DIR, safeFile(room.key)), JSON.stringify(room.snapshot), "utf8");
}
async function loadSnapshot(room) {
  if (room.snapshot || !DATA_DIR) return room.snapshot;
  try { room.snapshot = JSON.parse(await readFile(join(DATA_DIR, safeFile(room.key)), "utf8")); }
  catch { /* first snapshot has not been persisted yet */ }
  return room.snapshot;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  if (req.method === "OPTIONS") { res.writeHead(204, headers); return res.end(); }
  const access = authenticate(req, url);
  if (!access) return json(res, 401, { error: "unauthorized" });

  try {
    if (req.method === "GET" && url.pathname === "/health") return json(res, 200, { ok: true, service: "ai-design-canvas-collaboration-relay", rooms: rooms.size });

    if (req.method === "GET" && url.pathname === "/events") {
      const roomId = url.searchParams.get("roomId") || "";
      const projectId = url.searchParams.get("projectId") || "";
      const clientId = url.searchParams.get("clientId") || "";
      if (!roomId || !projectId || !clientId) return json(res, 400, { error: "roomId, projectId and clientId are required" });
      if (!requireAccess(res, access, roomId, projectId, "viewer")) return;
      const room = getRoom(roomId, projectId);
      res.writeHead(200, { ...headers, "content-type": "text/event-stream; charset=utf-8", connection: "keep-alive", "x-accel-buffering": "no" });
      res.write(": connected\n\n");
      room.clients.set(clientId, res);
      sendEvent(res, "presence", presenceList(room));
      const snapshot = await loadSnapshot(room);
      if (snapshot) sendEvent(res, "snapshot", { project: snapshot });
      const heartbeat = setInterval(() => res.write(": ping\n\n"), 20_000);
      req.on("close", () => {
        clearInterval(heartbeat);
        room.clients.delete(clientId);
        room.presences.delete(clientId);
        broadcastPresence(room);
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/snapshot") {
      const roomId = url.searchParams.get("roomId") || "";
      const projectId = url.searchParams.get("projectId") || "";
      if (!roomId || !projectId) return json(res, 400, { error: "roomId and projectId are required" });
      if (!requireAccess(res, access, roomId, projectId, "viewer")) return;
      const snapshot = await loadSnapshot(getRoom(roomId, projectId));
      return snapshot ? json(res, 200, { project: snapshot }) : json(res, 404, { error: "snapshot_not_found" });
    }

    if (req.method === "POST" && url.pathname === "/operations") {
      const envelope = await readBody(req);
      if (!envelope.roomId || !envelope.projectId || !envelope.clientId || !Array.isArray(envelope.operations)) return json(res, 400, { error: "invalid_envelope" });
      if (!requireAccess(res, access, String(envelope.roomId), String(envelope.projectId), "editor")) return;
      if (envelope.operations.length > 200) return json(res, 400, { error: "operation_limit_exceeded" });
      const room = getRoom(String(envelope.roomId), String(envelope.projectId));
      broadcast(room, "operations", envelope, String(envelope.clientId));
      return json(res, 200, { ok: true, delivered: Math.max(0, room.clients.size - (room.clients.has(String(envelope.clientId)) ? 1 : 0)) });
    }

    if (req.method === "POST" && url.pathname === "/presence") {
      const body = await readBody(req);
      if (!body.roomId || !body.projectId || !body.clientId || !body.presence) return json(res, 400, { error: "invalid_presence" });
      if (!requireAccess(res, access, String(body.roomId), String(body.projectId), "viewer")) return;
      const room = getRoom(String(body.roomId), String(body.projectId));
      room.presences.set(String(body.clientId), body.presence);
      broadcastPresence(room);
      return json(res, 200, { ok: true, peers: room.presences.size });
    }

    if (req.method === "POST" && url.pathname === "/snapshot") {
      const body = await readBody(req);
      if (!body.roomId || !body.projectId || !body.project || body.project.id !== body.projectId) return json(res, 400, { error: "invalid_snapshot" });
      if (!requireAccess(res, access, String(body.roomId), String(body.projectId), "editor")) return;
      const room = getRoom(String(body.roomId), String(body.projectId));
      room.snapshot = body.project;
      await persistSnapshot(room);
      broadcast(room, "snapshot", { project: body.project }, String(body.clientId || ""));
      return json(res, 200, { ok: true });
    }

    return json(res, 404, { error: "not_found" });
  } catch (error) {
    const status = Number(error?.status || 500);
    return json(res, status, { error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`AI Design Canvas collaboration relay listening on http://${HOST}:${PORT}`);
  if (!TOKEN && !SECRET) console.warn("No COLLAB_TOKEN or COLLAB_SECRET is set; run behind a trusted network or configure authentication before public exposure.");
  if (SECRET) console.log("Signed viewer/editor collaboration tokens are enabled.");
  if (DATA_DIR) console.log(`Snapshot persistence: ${DATA_DIR}`);
});
