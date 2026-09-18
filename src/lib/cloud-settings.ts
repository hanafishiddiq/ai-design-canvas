import type { CloudSession } from "./cloud";

const ENDPOINT_KEY = "ai-design-canvas.cloud.endpoint.v1";
const TOKEN_KEY = "ai-design-canvas.cloud.token.v1";
const USER_KEY = "ai-design-canvas.cloud.user.v1";
const EVENT = "ai-design-canvas:cloud-session";
export const DEFAULT_CLOUD_ENDPOINT = "http://127.0.0.1:8790";

export interface CloudSessionSettings {
  endpoint: string;
  token?: string;
  user?: CloudSession["user"];
  expiresAt?: string;
}

export function loadCloudSession(): CloudSessionSettings {
  if (typeof window === "undefined") return { endpoint: DEFAULT_CLOUD_ENDPOINT };
  let user: CloudSession["user"] | undefined;
  try { user = JSON.parse(sessionStorage.getItem(USER_KEY) || "null") || undefined; } catch { /* ignore */ }
  const expiresAt = sessionStorage.getItem("ai-design-canvas.cloud.expires.v1") || undefined;
  if (expiresAt && Date.now() >= Date.parse(expiresAt)) {
    sessionStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(USER_KEY); sessionStorage.removeItem("ai-design-canvas.cloud.expires.v1");
    user = undefined;
  }
  return {
    endpoint: localStorage.getItem(ENDPOINT_KEY) || DEFAULT_CLOUD_ENDPOINT,
    token: sessionStorage.getItem(TOKEN_KEY) || undefined,
    user,
    expiresAt,
  };
}
export function saveCloudEndpoint(endpoint: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ENDPOINT_KEY, endpoint);
  window.dispatchEvent(new Event(EVENT));
}
export function saveCloudSession(endpoint: string, session: CloudSession) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ENDPOINT_KEY, endpoint);
  sessionStorage.setItem(TOKEN_KEY, session.token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(session.user));
  sessionStorage.setItem("ai-design-canvas.cloud.expires.v1", session.expiresAt);
  window.dispatchEvent(new Event(EVENT));
}
export function clearCloudSession() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(USER_KEY); sessionStorage.removeItem("ai-design-canvas.cloud.expires.v1");
  window.dispatchEvent(new Event(EVENT));
}
export function subscribeCloudSession(listener: (session: CloudSessionSettings) => void) {
  if (typeof window === "undefined") return () => {};
  const onChange = () => listener(loadCloudSession());
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => { window.removeEventListener(EVENT, onChange); window.removeEventListener("storage", onChange); };
}
