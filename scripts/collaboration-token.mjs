import { randomBytes } from "node:crypto";
import { mintCollaborationToken } from "./collaboration-auth.mjs";

const args = process.argv.slice(2);
const value = (name, fallback = "") => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] || fallback : fallback;
};
const projectId = value("project");
const roomId = value("room");
const role = value("role", "editor");
const name = value("name", role === "viewer" ? "Reviewer" : "Designer");
const ttlHours = Number(value("ttl-hours", "24"));
const secret = process.env.COLLAB_SECRET || value("secret");

if (!projectId) {
  console.error("Usage: COLLAB_SECRET=... npm run collab:token -- --project <id> [--room <id>] [--role viewer|editor] [--name Name] [--ttl-hours 24]");
  process.exit(1);
}
if (!secret) {
  console.error("COLLAB_SECRET is required. Example strong secret:", randomBytes(32).toString("hex"));
  process.exit(1);
}
if (!["viewer", "editor", "admin"].includes(role)) {
  console.error("role must be viewer, editor, or admin");
  process.exit(1);
}
if (!Number.isFinite(ttlHours) || ttlHours <= 0) {
  console.error("ttl-hours must be a positive number");
  process.exit(1);
}

const now = Math.floor(Date.now() / 1000);
const token = mintCollaborationToken(secret, {
  projectId,
  ...(roomId ? { roomId } : {}),
  role,
  name,
  iat: now,
  exp: now + Math.round(ttlHours * 3600),
});
console.log(token);
