import { BroadcastCollaborationTransport, type CollaborationTransport } from "./collaboration";
import { HttpSseCollaborationTransport } from "./collaboration-http";

export type CollaborationMode = "local" | "remote";
export interface CollaborationSettings {
  mode: CollaborationMode;
  endpoint: string;
  roomId: string;
  displayName: string;
  token?: string;
}

const STORAGE_KEY = "ai-design-canvas.collaboration.settings.v1";
const TOKEN_KEY = "ai-design-canvas.collaboration.token.v1";
const EVENT_NAME = "ai-design-canvas:collaboration-settings";

export const defaultCollaborationSettings: CollaborationSettings = {
  mode: "local",
  endpoint: "http://127.0.0.1:8787",
  roomId: "",
  displayName: "Designer",
};

export function loadCollaborationSettings(): CollaborationSettings {
  if (typeof window === "undefined") return defaultCollaborationSettings;
  let stored: Partial<CollaborationSettings> = {};
  try { stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as Partial<CollaborationSettings>; } catch { /* ignore malformed local settings */ }
  return {
    ...defaultCollaborationSettings,
    ...stored,
    token: sessionStorage.getItem(TOKEN_KEY) || undefined,
  };
}

export function saveCollaborationSettings(settings: CollaborationSettings) {
  if (typeof window === "undefined") return;
  const { token, ...persistent } = settings;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(persistent));
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: settings }));
}

export function subscribeCollaborationSettings(listener: (settings: CollaborationSettings) => void) {
  if (typeof window === "undefined") return () => {};
  const onCustom = (event: Event) => listener((event as CustomEvent<CollaborationSettings>).detail);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener(loadCollaborationSettings());
  };
  window.addEventListener(EVENT_NAME, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT_NAME, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}

export function createCollaborationTransport(settings: CollaborationSettings, projectId: string, clientId: string): CollaborationTransport {
  const roomId = settings.roomId.trim() || projectId;
  if (settings.mode === "remote") {
    return new HttpSseCollaborationTransport(roomId, projectId, settings.endpoint.trim(), settings.token, clientId);
  }
  return new BroadcastCollaborationTransport(roomId, projectId, clientId);
}
