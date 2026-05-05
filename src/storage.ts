import type { TokenPair, TokenStorage, VerobaseConfig } from "./types.js";

const ACCESS_KEY = "vb_access";
const REFRESH_KEY = "vb_refresh";
const EXPIRES_KEY = "vb_expires";

// ── In-memory storage (Tauri / SSR) ───────────────────────────────

class MemoryStorage implements TokenStorage {
  private access: string | null = null;
  private refresh: string | null = null;

  getAccessToken() { return this.access; }
  getRefreshToken() { return this.refresh; }

  setTokens(pair: TokenPair) {
    this.access = pair.access_token;
    this.refresh = pair.refresh_token;
  }

  clearTokens() {
    this.access = null;
    this.refresh = null;
  }
}

// ── Web storage (localStorage / sessionStorage) ────────────────────

class WebStorage implements TokenStorage {
  constructor(private readonly store: Storage) {}

  getAccessToken() { return this.store.getItem(ACCESS_KEY); }
  getRefreshToken() { return this.store.getItem(REFRESH_KEY); }

  setTokens(pair: TokenPair) {
    this.store.setItem(ACCESS_KEY, pair.access_token);
    this.store.setItem(REFRESH_KEY, pair.refresh_token);
    this.store.setItem(EXPIRES_KEY, String(Date.now() + pair.expires_in * 1000));
  }

  clearTokens() {
    this.store.removeItem(ACCESS_KEY);
    this.store.removeItem(REFRESH_KEY);
    this.store.removeItem(EXPIRES_KEY);
  }
}

export function createStorage(cfg: VerobaseConfig): TokenStorage {
  const backend = cfg.storage ?? "localStorage";
  if (backend === "memory") return new MemoryStorage();
  if (backend === "sessionStorage") return new WebStorage(sessionStorage);
  return new WebStorage(localStorage);
}
