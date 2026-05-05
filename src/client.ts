import { AnalyticsModule } from "./analytics.js";
import { AppControlModule } from "./app-control.js";
import { AuthModule } from "./auth.js";
import { HttpClient } from "./http.js";
import { createStorage } from "./storage.js";
import type { VerobaseConfig } from "./types.js";

export class VerobaseClient {
  readonly auth: AuthModule;
  readonly appControl: AppControlModule;
  readonly analytics: AnalyticsModule;

  private readonly http: HttpClient;

  constructor(config: VerobaseConfig) {
    const storage = createStorage(config);
    this.http = new HttpClient(config.baseUrl, storage);

    if (config.publishableKey) {
      this.http.setPublishableKey(config.publishableKey);
    }

    // serviceId may be empty for single-tenant mode (server resolves
    // VEROBASE_DEFAULT_SERVICE_SLUG). Modules pass it through into the
    // legacy /v1/{service_id}/* path; when empty, they should hit the
    // clean /v1/* form. The modules accept undefined and switch.
    const svc = config.serviceId ?? "";
    this.auth = new AuthModule(this.http, storage, svc);
    this.appControl = new AppControlModule(this.http, svc);
    this.analytics = new AnalyticsModule(this.http, storage, svc);

    // Wire silent-refresh into the HTTP client
    this.http.setRefreshFn(() => this.auth.refresh());
  }
}

// ── Singleton factory ──────────────────────────────────────────────

let _instance: VerobaseClient | null = null;

/**
 * Initialise the global Verobase client. Call once at app startup.
 *
 * @example
 * import { init, verobase } from "@verobase/web-sdk";
 *
 * init({ baseUrl: "https://api.example.com", serviceId: "..." });
 * await verobase.auth.login({ email, password });
 */
export function init(config: VerobaseConfig): VerobaseClient {
  _instance = new VerobaseClient(config);
  return _instance;
}

/**
 * The global Verobase client instance. Must call `init()` first.
 */
export const verobase: VerobaseClient = new Proxy({} as VerobaseClient, {
  get(_target, prop) {
    if (!_instance) {
      throw new Error("Verobase SDK not initialised — call init() before using verobase.");
    }
    return (_instance as unknown as Record<string | symbol, unknown>)[prop];
  },
});
