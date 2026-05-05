import type { HttpClient } from "./http.js";
import type { TokenStorage } from "./types.js";
import type {
  CwvPayload,
  GroupOptions,
  PageviewPayload,
  ReplayRecordOptions,
  ScreenviewPayload,
  TrackEventPayload,
  UserPropertiesPayload,
} from "./types.js";

function generateId(): string {
  return crypto.randomUUID();
}

function getOrCreateSessionId(): string {
  const key = "vb_session_id";
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const id = generateId();
  sessionStorage.setItem(key, id);
  return id;
}

export class AnalyticsModule {
  private readonly siteId: string;
  private readonly serviceId: string;

  constructor(
    private readonly http: HttpClient,
    private readonly storage: TokenStorage,
    serviceId: string,
  ) {
    this.siteId = serviceId;
    this.serviceId = serviceId;
  }

  /**
   * Builds the API path prefix used by every analytics request.
   * Empty serviceId → clean `/v1` (server resolves tenant via header
   * or single-tenant config). Non-empty → legacy `/v1/{service_id}`.
   */
  private prefix() {
    return this.serviceId ? `/v1/${this.serviceId}` : `/v1`;
  }

  private buildBase() {
    return {
      site_id: this.siteId,
      service_id: this.serviceId,
      session_id: getOrCreateSessionId(),
      user_id: this.storage.getAccessToken() ? (this._extractUserId() ?? "") : "",
      timestamp: new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, ""),
      platform: "web",
    };
  }

  private _extractUserId(): string | null {
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
  track(name: string, props?: Record<string, unknown>, options?: { revenue?: number; currency?: string }): void {
    const payload: TrackEventPayload = { name, props, revenue: options?.revenue, currency: options?.currency };
    const event: Record<string, unknown> = {
      ...this.buildBase(),
      type: "custom_event",
      event_name: payload.name,
      props: JSON.stringify(payload.props ?? {}),
    };
    if (payload.revenue !== undefined) event.revenue = payload.revenue;
    if (payload.currency !== undefined) event.currency = payload.currency;
    this._send(event);
  }

  /**
   * Track a pageview (web).
   * Automatically picks up window.location and document.title when omitted.
   */
  pageview(data?: PageviewPayload): void {
    const pathname =
      data?.pathname ?? (typeof window !== "undefined" ? window.location.pathname : "");
    const page_title =
      data?.page_title ?? (typeof document !== "undefined" ? document.title : "");
    const referrer =
      data?.referrer ?? (typeof document !== "undefined" ? document.referrer : "");
    const screen_width =
      data?.screen_width ?? (typeof window !== "undefined" ? window.screen.width : 0);
    const screen_height =
      data?.screen_height ?? (typeof window !== "undefined" ? window.screen.height : 0);

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
      utm_content: data?.utm_content ?? "",
    });
  }

  /**
   * Track a screen view (mobile / app).
   * @example verobase.analytics.screen("ProductDetail")
   */
  screen(screenName: string, props?: Record<string, unknown>): void {
    const payload: ScreenviewPayload = { screen_name: screenName, props };
    this._send({
      ...this.buildBase(),
      type: "screen",
      event_name: payload.screen_name,
      props: JSON.stringify(payload.props ?? {}),
    });
  }

  /**
   * Set user properties (identify call).
   * Links the current session/user to the given properties.
   */
  setUserProperties(props: UserPropertiesPayload): void {
    const userId = this._extractUserId();
    if (!userId) return;
    this.http
      .post(`${this.prefix()}/analytics/identify`, {
        user_id: userId,
        ...props,
      })
      .catch(() => {/* fire-and-forget */});
  }

  /**
   * Send a Core Web Vitals measurement (web only).
   * Integrate with the `web-vitals` package:
   * @example
   * import { onLCP, onINP, onCLS } from "web-vitals";
   * onLCP(m => verobase.analytics.trackWebVital({ metric_name: "LCP", value: m.value, rating: m.rating }));
   */
  trackWebVital(payload: CwvPayload): void {
    this.http
      .post(`${this.prefix()}/analytics/cwv`, {
        ...payload,
        session_id: getOrCreateSessionId(),
        user_id: this._extractUserId() ?? "",
        pathname: typeof window !== "undefined" ? window.location.pathname : "",
      })
      .catch(() => {/* fire-and-forget */});
  }

  /**
   * Track a search query event.
   * Internally calls `track("__search", { query, results_count, category })`.
   * @example verobase.analytics.search("nike shoes", { results_count: 42, category: "footwear" })
   */
  search(query: string, options?: { results_count?: number; category?: string }): void {
    this.track("__search", {
      query,
      results_count: options?.results_count ?? -1,
      category: options?.category ?? "",
    });
  }

  /**
   * Associate the current user with a group (company, team, etc.).
   * @example verobase.analytics.group({ groupId: "org_123", groupType: "company", properties: { plan: "pro" } })
   */
  async group(options: GroupOptions): Promise<void> {
    await this.http.post(`${this.prefix()}/analytics/group`, {
      group_id: options.groupId,
      group_type: options.groupType,
      properties: options.properties,
    });
  }

  /**
   * Send session replay events for visual playback.
   * @example verobase.analytics.sendReplayEvents("sess_abc", replayEvents)
   */
  async sendReplayEvents(sessionId: string, events: unknown[]): Promise<void> {
    // Split into chunks of 100 events to stay under server body limit
    const CHUNK_SIZE = 100;
    for (let i = 0; i < events.length; i += CHUNK_SIZE) {
      await this.http.post(`${this.prefix()}/analytics/replay`, {
        session_id: sessionId,
        events: events.slice(i, i + CHUNK_SIZE),
      });
    }
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
  startReplay(options?: ReplayRecordOptions): (() => void) {
    let stopFn: (() => void) | null = null;
    const sessionId = getOrCreateSessionId();

    // Fetch settings from server, then conditionally start recording
    this.http.get(`${this.prefix()}/replay-settings`, { auth: false })
      .then((raw: unknown) => {
        const settings = raw as { enabled?: boolean; sampling_rate?: number; max_duration?: number };
        // Check if enabled
        if (!settings.enabled) return;

        // Sampling: only record X% of sessions
        if (Math.random() >= (settings.sampling_rate ?? 0.1)) return;

        // Import rrweb dynamically — use Function constructor to prevent webpack static analysis
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, no-new-func
        const loadRrweb = new Function("return import('rrweb')") as () => Promise<any>;
        return loadRrweb().then(({ record }: { record: any }) => {
          const batchBuffer: unknown[] = [];

          stopFn = record({
            // ── Privacy: ALWAYS mask all inputs ──
            maskAllInputs: true,
            maskInputOptions: {
              password: true,
              email: true,
              tel: true,
              ...options?.maskInputOptions,
            },
            maskTextSelector: options?.maskTextSelector ?? null,
            blockSelector: options?.blockSelector ?? undefined,
            maskInputFn: options?.maskInputFn,
            maskTextFn: options?.maskTextFn,
            sampling: {
              mousemove: false,
              mouseInteraction: { MouseUp: false, MouseDown: false, ContextMenu: false, DblClick: false, Focus: false, Blur: false, TouchStart: false, TouchEnd: false },
              scroll: 150,
              media: 800,
              input: "last" as unknown as boolean,
              ...options?.sampling,
            },
            emit: (event: unknown) => { batchBuffer.push(event); },
          }) ?? null;

          // Flush every 5 seconds
          const flushTimer = setInterval(() => {
            if (batchBuffer.length === 0) return;
            const batch = batchBuffer.splice(0);
            this.sendReplayEvents(sessionId, batch).catch(() => {});
          }, 5000);

          // Auto-stop after max_duration
          const maxTimer = setTimeout(() => {
            stopFn?.();
            clearInterval(flushTimer);
            if (batchBuffer.length > 0) {
              this.sendReplayEvents(sessionId, batchBuffer.splice(0)).catch(() => {});
            }
          }, (settings.max_duration || 3600) * 1000);

          // Update stop function to clean up timers
          const originalStop = stopFn;
          stopFn = () => {
            originalStop?.();
            clearInterval(flushTimer);
            clearTimeout(maxTimer);
            if (batchBuffer.length > 0) {
              this.sendReplayEvents(sessionId, batchBuffer.splice(0)).catch(() => {});
            }
          };
        });
      })
      .catch(() => {
        // Settings fetch failed — don't record
      });

    // Return stop function
    return () => { stopFn?.(); };
  }

  // ── Internal ──────────────────────────────────────────────────────

  private _send(event: Record<string, unknown>): void {
    this.http
      .post(
        `${this.prefix()}/analytics/track`,
        { events: [event] },
        { auth: false },
      )
      .catch(() => {/* fire-and-forget — never throw in analytics */});
  }
}
