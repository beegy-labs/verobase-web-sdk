// src/analytics.ts
function generateId() {
  return crypto.randomUUID();
}
function getOrCreateSessionId() {
  const key = "vb_session_id";
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const id = generateId();
  sessionStorage.setItem(key, id);
  return id;
}
var AnalyticsModule = class {
  constructor(http, storage, serviceId) {
    this.http = http;
    this.storage = storage;
    this.siteId = serviceId;
    this.serviceId = serviceId;
  }
  buildBase() {
    return {
      site_id: this.siteId,
      service_id: this.serviceId,
      session_id: getOrCreateSessionId(),
      user_id: this.storage.getAccessToken() ? this._extractUserId() ?? "" : "",
      timestamp: (/* @__PURE__ */ new Date()).toISOString().replace("T", " ").replace(/\.\d{3}Z$/, ""),
      platform: "web"
    };
  }
  _extractUserId() {
    const token = this.storage.getAccessToken();
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.sub ?? null;
    } catch {
      return null;
    }
  }
  /**
   * Track a custom event.
   * @example verobase.analytics.track("purchase", { amount: 29900, revenue: 299, currency: "USD" })
   */
  track(name, props, options) {
    const payload = { name, props, revenue: options?.revenue, currency: options?.currency };
    const event = {
      ...this.buildBase(),
      type: "custom_event",
      event_name: payload.name,
      props: JSON.stringify(payload.props ?? {})
    };
    if (payload.revenue !== void 0) event.revenue = payload.revenue;
    if (payload.currency !== void 0) event.currency = payload.currency;
    this._send(event);
  }
  /**
   * Track a pageview (web).
   * Automatically picks up window.location and document.title when omitted.
   */
  pageview(data) {
    const pathname = data?.pathname ?? (typeof window !== "undefined" ? window.location.pathname : "");
    const page_title = data?.page_title ?? (typeof document !== "undefined" ? document.title : "");
    const referrer = data?.referrer ?? (typeof document !== "undefined" ? document.referrer : "");
    const screen_width = data?.screen_width ?? (typeof window !== "undefined" ? window.screen.width : 0);
    const screen_height = data?.screen_height ?? (typeof window !== "undefined" ? window.screen.height : 0);
    this._send({
      ...this.buildBase(),
      type: "pageview",
      pathname,
      page_title,
      referrer,
      screen_width,
      screen_height,
      utm_source: data?.utm_source ?? "",
      utm_medium: data?.utm_medium ?? "",
      utm_campaign: data?.utm_campaign ?? "",
      utm_term: data?.utm_term ?? "",
      utm_content: data?.utm_content ?? ""
    });
  }
  /**
   * Track a screen view (mobile / app).
   * @example verobase.analytics.screen("ProductDetail")
   */
  screen(screenName, props) {
    const payload = { screen_name: screenName, props };
    this._send({
      ...this.buildBase(),
      type: "screen",
      event_name: payload.screen_name,
      props: JSON.stringify(payload.props ?? {})
    });
  }
  /**
   * Set user properties (identify call).
   * Links the current session/user to the given properties.
   */
  setUserProperties(props) {
    const userId = this._extractUserId();
    if (!userId) return;
    this.http.post(`/v1/${this.serviceId}/analytics/identify`, {
      user_id: userId,
      ...props
    }).catch(() => {
    });
  }
  /**
   * Send a Core Web Vitals measurement (web only).
   * Integrate with the `web-vitals` package:
   * @example
   * import { onLCP, onINP, onCLS } from "web-vitals";
   * onLCP(m => verobase.analytics.trackWebVital({ metric_name: "LCP", value: m.value, rating: m.rating }));
   */
  trackWebVital(payload) {
    this.http.post(`/v1/${this.serviceId}/analytics/cwv`, {
      ...payload,
      session_id: getOrCreateSessionId(),
      user_id: this._extractUserId() ?? "",
      pathname: typeof window !== "undefined" ? window.location.pathname : ""
    }).catch(() => {
    });
  }
  /**
   * Associate the current user with a group (company, team, etc.).
   * @example verobase.analytics.group({ groupId: "org_123", groupType: "company", properties: { plan: "pro" } })
   */
  async group(options) {
    await this.http.post(`/v1/${this.serviceId}/analytics/group`, {
      group_id: options.groupId,
      group_type: options.groupType,
      properties: options.properties
    });
  }
  /**
   * Send session replay events for visual playback.
   * @example verobase.analytics.sendReplayEvents("sess_abc", replayEvents)
   */
  async sendReplayEvents(sessionId, events) {
    await this.http.post(`/v1/${this.serviceId}/analytics/replay`, {
      session_id: sessionId,
      events
    });
  }
  /**
   * Start rrweb session replay recording with privacy-safe defaults.
   *
   * **All input values are always masked** — `maskAllInputs: true` is enforced
   * and cannot be overridden. Sensitive input types (password, email, tel) are
   * masked by default. Original input values never leave the browser.
   *
   * Requires `rrweb` as a peer dependency:
   * ```bash
   * npm install rrweb
   * ```
   *
   * @example
   * const stop = verobase.analytics.startReplay();
   * // ... later
   * stop(); // stops recording
   *
   * @example
   * // With additional masking
   * verobase.analytics.startReplay({
   *   maskTextSelector: ".pii",
   *   blockSelector: ".credit-card-form",
   * });
   */
  startReplay(options) {
    let stopFn = null;
    const sessionId = getOrCreateSessionId();
    this.http.get(`/v1/${this.serviceId}/replay-settings`, { auth: false }).then((raw) => {
      const settings = raw;
      if (!settings.enabled) return;
      if (Math.random() >= (settings.sampling_rate ?? 0.1)) return;
      const loadRrweb = new Function("return import('rrweb')");
      return loadRrweb().then(({ record }) => {
        const batchBuffer = [];
        stopFn = record({
          // ── Privacy: ALWAYS mask all inputs ──
          maskAllInputs: true,
          maskInputOptions: {
            password: true,
            email: true,
            tel: true,
            ...options?.maskInputOptions
          },
          maskTextSelector: options?.maskTextSelector ?? null,
          blockSelector: options?.blockSelector ?? void 0,
          maskInputFn: options?.maskInputFn,
          maskTextFn: options?.maskTextFn,
          sampling: {
            mousemove: false,
            mouseInteraction: { MouseUp: false, MouseDown: false, ContextMenu: false, DblClick: false, Focus: false, Blur: false, TouchStart: false, TouchEnd: false },
            scroll: 150,
            media: 800,
            input: "last",
            ...options?.sampling
          },
          emit: (event) => {
            batchBuffer.push(event);
          }
        }) ?? null;
        const flushTimer = setInterval(() => {
          if (batchBuffer.length === 0) return;
          const batch = batchBuffer.splice(0);
          this.sendReplayEvents(sessionId, batch).catch(() => {
          });
        }, 5e3);
        const maxTimer = setTimeout(() => {
          stopFn?.();
          clearInterval(flushTimer);
          if (batchBuffer.length > 0) {
            this.sendReplayEvents(sessionId, batchBuffer.splice(0)).catch(() => {
            });
          }
        }, (settings.max_duration || 3600) * 1e3);
        const originalStop = stopFn;
        stopFn = () => {
          originalStop?.();
          clearInterval(flushTimer);
          clearTimeout(maxTimer);
          if (batchBuffer.length > 0) {
            this.sendReplayEvents(sessionId, batchBuffer.splice(0)).catch(() => {
            });
          }
        };
      });
    }).catch(() => {
    });
    return () => {
      stopFn?.();
    };
  }
  // ── Internal ──────────────────────────────────────────────────────
  _send(event) {
    this.http.post(
      `/v1/${this.serviceId}/analytics/track`,
      { events: [event] },
      { auth: false }
    ).catch(() => {
    });
  }
};

// src/app-control.ts
var AppControlModule = class {
  constructor(http, serviceId) {
    this.http = http;
    this.serviceId = serviceId;
  }
  /**
   * Check whether the given app version requires an update.
   *
   * @example
   * const result = await verobase.appControl.checkVersion({
   *   platform: "android",
   *   current_version: "1.2.3",
   * });
   * if (result.update_type === "FORCE") {
   *   // redirect to store_url
   * }
   */
  async checkVersion(req) {
    const params = new URLSearchParams({
      platform: req.platform,
      current_version: req.current_version
    });
    return this.http.get(
      `/v1/${this.serviceId}/app/version-check?${params}`,
      { auth: false }
    );
  }
  /**
   * Shorthand: returns true when a forced update is required.
   */
  async isForceUpdateRequired(platform, currentVersion) {
    const result = await this.checkVersion({ platform, current_version: currentVersion });
    return result.update_type === "FORCE";
  }
  /** Check maintenance mode status. */
  async checkMaintenance() {
    return this.http.get(`/v1/${this.serviceId}/app/maintenance`, { auth: false });
  }
  /** Get all remote config key-value pairs. */
  async getRemoteConfig() {
    return this.http.get(`/v1/${this.serviceId}/app/config`, { auth: false });
  }
  /** Get feature flags as {key: boolean} map. */
  async getFeatures() {
    return this.http.get(`/v1/${this.serviceId}/app/features`, { auth: false });
  }
  /** Get active notices (optionally filtered by platform/version). */
  async getNotices(platform, version) {
    const params = new URLSearchParams();
    if (platform) params.set("platform", platform);
    if (version) params.set("version", version);
    const qs = params.toString();
    return this.http.get(`/v1/${this.serviceId}/app/notices${qs ? `?${qs}` : ""}`, { auth: false });
  }
  /** Get latest active terms per type. */
  async getTerms() {
    return this.http.get(`/v1/${this.serviceId}/app/terms`, { auth: false });
  }
  /** Record user agreement to a terms document. */
  async agreeToTerms(termsId) {
    await this.http.post(`/v1/${this.serviceId}/app/terms/${termsId}/agree`, void 0);
  }
};

// src/auth.ts
var AuthModule = class {
  constructor(http, storage, serviceId) {
    this.http = http;
    this.storage = storage;
    this.serviceId = serviceId;
  }
  get base() {
    return `/v1/${this.serviceId}/auth`;
  }
  /**
   * Register a new user. A verification email is sent automatically.
   * Returns the raw API response (no tokens yet; user must verify email first).
   */
  async register(req) {
    return this.http.post(`${this.base}/register`, req, { auth: false });
  }
  /**
   * Confirm email address with the token from the verification email.
   */
  async verifyEmail(req) {
    return this.http.post(`${this.base}/verify-email`, req, { auth: false });
  }
  /**
   * Login with email + password.
   *
   * If MFA is enabled, returns `{ mfa_required: true, mfa_token: "..." }` instead of tokens.
   * In that case, call `completeMfaLogin()` with the mfa_token and TOTP code.
   */
  async login(req) {
    const resp = await this.http.post(`${this.base}/login`, req, { auth: false });
    if (resp.access_token && resp.refresh_token) {
      this.storage.setTokens({
        access_token: resp.access_token,
        refresh_token: resp.refresh_token,
        expires_in: 900
      });
    }
    return resp;
  }
  /**
   * Complete MFA login — exchange mfa_token + TOTP code for tokens.
   */
  async completeMfaLogin(req) {
    const pair = await this.http.post(`${this.base}/login/mfa`, req, { auth: false });
    this.storage.setTokens(pair);
    return pair;
  }
  /**
   * Silently rotate tokens using the stored refresh token.
   * Returns true on success, false if the session is expired/invalid.
   */
  async refresh() {
    const refreshToken = this.storage.getRefreshToken();
    if (!refreshToken) return false;
    try {
      const pair = await this.http.post(
        `${this.base}/refresh`,
        { refresh_token: refreshToken },
        { auth: false, skipRefresh: true }
      );
      this.storage.setTokens(pair);
      return true;
    } catch {
      this.storage.clearTokens();
      return false;
    }
  }
  /**
   * Logout the current user and clear local tokens.
   */
  async logout() {
    try {
      await this.http.post(`${this.base}/logout`, void 0, { auth: true });
    } finally {
      this.storage.clearTokens();
    }
  }
  /**
   * Request a password-reset email.
   */
  async requestPasswordReset(req) {
    return this.http.post(`${this.base}/password-reset/request`, req, { auth: false });
  }
  /**
   * Confirm a password reset using the token from the email.
   */
  async confirmPasswordReset(req) {
    return this.http.post(`${this.base}/password-reset/confirm`, req, { auth: false });
  }
  /** Returns the current access token, or null if not authenticated. */
  getAccessToken() {
    return this.storage.getAccessToken();
  }
  /** Returns true if there is a locally stored access token. */
  isAuthenticated() {
    return this.storage.getAccessToken() !== null;
  }
  // ── Social Login ─────────────────────────────────────────────────
  /**
   * Start social login flow by redirecting to the provider's auth page.
   * After the user authenticates, the provider redirects back to `callbackUrl`.
   */
  socialLogin(provider, callbackUrl) {
    const cb = callbackUrl ?? `${window.location.origin}/auth/callback`;
    const url = `${this.http["baseUrl"]}${this.base}/social/${provider}?callback_url=${encodeURIComponent(cb)}`;
    window.location.href = url;
  }
  /**
   * Handle the social login callback. Call this on your callback page.
   * Extracts `state` and `code` from URL params, exchanges for tokens.
   */
  async handleCallback(params) {
    const p = params ?? parseCallbackParams();
    const resp = await this.http.get(
      `${this.base}/social/callback?state=${encodeURIComponent(p.state)}&code=${encodeURIComponent(p.code)}`,
      { auth: false }
    );
    this.storage.setTokens({
      access_token: resp.access_token,
      refresh_token: resp.refresh_token,
      expires_in: 900
    });
    return resp;
  }
  // ── MFA ──────────────────────────────────────────────────────────
  /** Start TOTP setup. Returns secret, QR URI, and backup codes. */
  async setupMfa() {
    return this.http.post(`${this.base}/mfa/setup`, void 0, { auth: true });
  }
  /** Verify TOTP code to complete MFA setup. */
  async verifyMfa(req) {
    return this.http.post(`${this.base}/mfa/verify`, req, { auth: true });
  }
  /** Check if MFA is enabled for the current user. */
  async getMfaStatus() {
    return this.http.get(`${this.base}/mfa/status`, { auth: true });
  }
  /** Disable MFA for the current user. */
  async disableMfa() {
    return this.http.delete(`${this.base}/mfa`, { auth: true });
  }
  /** Regenerate backup codes. */
  async regenerateBackupCodes() {
    return this.http.post(`${this.base}/mfa/backup-codes`, void 0, { auth: true });
  }
  // ── API Keys ─────────────────────────────────────────────────────
  get apiKeyBase() {
    return `/v1/${this.serviceId}/api-keys`;
  }
  /**
   * Create a new API key. The `key` field in the response is shown **once only**.
   */
  async createApiKey(req) {
    return this.http.post(this.apiKeyBase, req, { auth: true });
  }
  /** List all API keys for the current user (key values are never returned). */
  async listApiKeys() {
    return this.http.get(this.apiKeyBase, { auth: true });
  }
  /** Revoke an API key by ID. */
  async revokeApiKey(keyId) {
    return this.http.delete(`${this.apiKeyBase}/${keyId}`, { auth: true });
  }
  // ── Legal / GDPR ─────────────────────────────────────────────────
  get legalBase() {
    return `/v1/${this.serviceId}`;
  }
  /** Get current policies for the service. */
  async getPolicies() {
    return this.http.get(`${this.legalBase}/policies`, { auth: false });
  }
  /** Check which policies the user hasn't consented to yet. */
  async getMissingConsents() {
    return this.http.get(`${this.legalBase}/consent/missing`, { auth: true });
  }
  /** Record user consent to a policy. */
  async recordConsent(req) {
    return this.http.post(`${this.legalBase}/consent`, req, { auth: true });
  }
  /** Request data export (GDPR). */
  async requestDataExport() {
    return this.http.post(`${this.legalBase}/gdpr`, { request_type: "export" }, { auth: true });
  }
  /** Request account deletion (GDPR). */
  async requestAccountDeletion() {
    return this.http.post(`${this.legalBase}/gdpr`, { request_type: "deletion" }, { auth: true });
  }
  /** List user's GDPR requests. */
  async getGdprRequests() {
    return this.http.get(`${this.legalBase}/gdpr`, { auth: true });
  }
  // ── Passwordless ─────────────────────────────────────────────────
  /**
   * Request a magic link to be sent to the user's email.
   */
  async requestMagicLink(email) {
    return this.http.post(`${this.base}/magic-link`, { email }, { auth: false });
  }
  /**
   * Verify a magic link token (from email URL param `?token=...`).
   * On success, stores tokens and returns the token pair.
   */
  async verifyMagicLink(token) {
    const pair = await this.http.post(`${this.base}/magic-link/verify`, { token }, { auth: false });
    this.storage.setTokens(pair);
    return pair;
  }
  /**
   * Request a 6-digit OTP sent to the user's email.
   */
  async requestOtp(email) {
    return this.http.post(`${this.base}/otp`, { email }, { auth: false });
  }
  /**
   * Verify the OTP code. On success, stores tokens and returns the token pair.
   */
  async verifyOtp(req) {
    const pair = await this.http.post(`${this.base}/otp/verify`, req, { auth: false });
    this.storage.setTokens(pair);
    return pair;
  }
  // ── Passkeys ─────────────────────────────────────────────────────
  /**
   * Start passkey registration. Returns WebAuthn PublicKeyCredentialCreationOptions.
   * Pass the result directly to `navigator.credentials.create()`.
   */
  async passkeyRegisterStart() {
    return this.http.post(`${this.base}/passkey/register/start`, void 0, { auth: true });
  }
  /**
   * Finish passkey registration. Pass the credential from `navigator.credentials.create()`.
   */
  async passkeyRegisterFinish(credential) {
    return this.http.post(`${this.base}/passkey/register/finish`, credential, { auth: true });
  }
  /**
   * Start passkey authentication for a given email.
   * Returns WebAuthn PublicKeyCredentialRequestOptions.
   */
  async passkeyAuthStart(email) {
    return this.http.post(`${this.base}/passkey/auth/start`, { email }, { auth: false });
  }
  /**
   * Finish passkey authentication. Pass the credential from `navigator.credentials.get()`.
   * On success, stores tokens.
   */
  async passkeyAuthFinish(credential) {
    const pair = await this.http.post(`${this.base}/passkey/auth/finish`, credential, { auth: false });
    this.storage.setTokens(pair);
    return pair;
  }
  /** List registered passkeys for the current user. */
  async listPasskeys() {
    return this.http.get(`${this.base}/passkey`, { auth: true });
  }
  /** Delete a passkey by credential ID. */
  async deletePasskey(credId) {
    return this.http.delete(`${this.base}/passkey/${credId}`, { auth: true });
  }
  // ── SSO ──────────────────────────────────────────────────────────
  /** List available SSO providers for the service. */
  async listSsoProviders() {
    return this.http.get(`${this.base}/sso`, { auth: false });
  }
  /**
   * Get the SSO initiation URL for a given provider.
   * Redirect the user to this URL to start the SSO flow.
   */
  ssoInitiateUrl(providerId) {
    return `${this.http["baseUrl"]}${this.base}/sso/${providerId}/initiate`;
  }
  /**
   * Handle the SSO callback. Call this on your SSO callback page.
   * Extracts `state` and `code` from URL params, completes the SSO flow.
   */
  async handleSsoCallback(providerId, params) {
    const p = params ?? parseSsoCallbackParams();
    const pair = await this.http.get(
      `${this.base}/sso/${providerId}/callback?state=${encodeURIComponent(p.state)}&code=${encodeURIComponent(p.code)}`,
      { auth: false }
    );
    this.storage.setTokens(pair);
    return pair;
  }
};
function parseCallbackParams() {
  const params = new URLSearchParams(window.location.search);
  const state = params.get("state");
  const code = params.get("code");
  if (!state || !code) {
    throw new Error("Missing state or code in callback URL");
  }
  return { state, code };
}
function parseSsoCallbackParams() {
  const params = new URLSearchParams(window.location.search);
  const state = params.get("state");
  const code = params.get("code");
  if (!state || !code) throw new Error("Missing state or code in SSO callback URL");
  return { state, code };
}

// src/http.ts
var ApiError = class extends Error {
  constructor(status, body) {
    super(`HTTP ${status}`);
    this.status = status;
    this.body = body;
    this.name = "ApiError";
  }
};
var HttpClient = class {
  constructor(baseUrl, storage) {
    this.baseUrl = baseUrl;
    this.storage = storage;
    this.refreshFn = null;
    this.refreshInFlight = null;
  }
  setRefreshFn(fn) {
    this.refreshFn = fn;
  }
  async request(method, path, body, opts = {}) {
    const { auth = true, skipRefresh = false } = opts;
    const headers = {
      "Content-Type": "application/json"
    };
    if (auth) {
      const token = this.storage.getAccessToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;
    }
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body !== void 0 ? JSON.stringify(body) : void 0
    });
    if (res.status === 401 && auth && !skipRefresh && this.refreshFn) {
      if (!this.refreshInFlight) {
        this.refreshInFlight = this.refreshFn().finally(() => {
          this.refreshInFlight = null;
        });
      }
      const refreshed = await this.refreshInFlight;
      if (refreshed) {
        return this.request(method, path, body, { auth, skipRefresh: true });
      }
    }
    if (!res.ok) {
      let errorBody;
      try {
        errorBody = await res.json();
      } catch {
        errorBody = await res.text();
      }
      throw new ApiError(res.status, errorBody);
    }
    if (res.status === 204) return void 0;
    return res.json();
  }
  get(path, opts) {
    return this.request("GET", path, void 0, opts);
  }
  post(path, body, opts) {
    return this.request("POST", path, body, opts);
  }
  delete(path, opts) {
    return this.request("DELETE", path, void 0, opts);
  }
};

// src/storage.ts
var ACCESS_KEY = "vb_access";
var REFRESH_KEY = "vb_refresh";
var EXPIRES_KEY = "vb_expires";
var MemoryStorage = class {
  constructor() {
    this.access = null;
    this.refresh = null;
  }
  getAccessToken() {
    return this.access;
  }
  getRefreshToken() {
    return this.refresh;
  }
  setTokens(pair) {
    this.access = pair.access_token;
    this.refresh = pair.refresh_token;
  }
  clearTokens() {
    this.access = null;
    this.refresh = null;
  }
};
var WebStorage = class {
  constructor(store) {
    this.store = store;
  }
  getAccessToken() {
    return this.store.getItem(ACCESS_KEY);
  }
  getRefreshToken() {
    return this.store.getItem(REFRESH_KEY);
  }
  setTokens(pair) {
    this.store.setItem(ACCESS_KEY, pair.access_token);
    this.store.setItem(REFRESH_KEY, pair.refresh_token);
    this.store.setItem(EXPIRES_KEY, String(Date.now() + pair.expires_in * 1e3));
  }
  clearTokens() {
    this.store.removeItem(ACCESS_KEY);
    this.store.removeItem(REFRESH_KEY);
    this.store.removeItem(EXPIRES_KEY);
  }
};
function createStorage(cfg) {
  const backend = cfg.storage ?? "localStorage";
  if (backend === "memory") return new MemoryStorage();
  if (backend === "sessionStorage") return new WebStorage(sessionStorage);
  return new WebStorage(localStorage);
}

// src/client.ts
var VerobaseClient = class {
  constructor(config) {
    const storage = createStorage(config);
    this.http = new HttpClient(config.baseUrl, storage);
    this.auth = new AuthModule(this.http, storage, config.serviceId);
    this.appControl = new AppControlModule(this.http, config.serviceId);
    this.analytics = new AnalyticsModule(this.http, storage, config.serviceId);
    this.http.setRefreshFn(() => this.auth.refresh());
  }
};
var _instance = null;
function init(config) {
  _instance = new VerobaseClient(config);
  return _instance;
}
var verobase = new Proxy({}, {
  get(_target, prop) {
    if (!_instance) {
      throw new Error("Verobase SDK not initialised \u2014 call init() before using verobase.");
    }
    return _instance[prop];
  }
});
export {
  AnalyticsModule,
  ApiError,
  AppControlModule,
  AuthModule,
  VerobaseClient,
  init,
  verobase
};
