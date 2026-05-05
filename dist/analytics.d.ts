import type { HttpClient } from "./http.js";
import type { TokenStorage } from "./types.js";
import type { CwvPayload, GroupOptions, PageviewPayload, ReplayRecordOptions, UserPropertiesPayload } from "./types.js";
export declare class AnalyticsModule {
    private readonly http;
    private readonly storage;
    private readonly siteId;
    private readonly serviceId;
    constructor(http: HttpClient, storage: TokenStorage, serviceId: string);
    private buildBase;
    private _extractUserId;
    /**
     * Track a custom event.
     * @example verobase.analytics.track("purchase", { amount: 29900, revenue: 299, currency: "USD" })
     */
    track(name: string, props?: Record<string, unknown>, options?: {
        revenue?: number;
        currency?: string;
    }): void;
    /**
     * Track a pageview (web).
     * Automatically picks up window.location and document.title when omitted.
     */
    pageview(data?: PageviewPayload): void;
    /**
     * Track a screen view (mobile / app).
     * @example verobase.analytics.screen("ProductDetail")
     */
    screen(screenName: string, props?: Record<string, unknown>): void;
    /**
     * Set user properties (identify call).
     * Links the current session/user to the given properties.
     */
    setUserProperties(props: UserPropertiesPayload): void;
    /**
     * Send a Core Web Vitals measurement (web only).
     * Integrate with the `web-vitals` package:
     * @example
     * import { onLCP, onINP, onCLS } from "web-vitals";
     * onLCP(m => verobase.analytics.trackWebVital({ metric_name: "LCP", value: m.value, rating: m.rating }));
     */
    trackWebVital(payload: CwvPayload): void;
    /**
     * Associate the current user with a group (company, team, etc.).
     * @example verobase.analytics.group({ groupId: "org_123", groupType: "company", properties: { plan: "pro" } })
     */
    group(options: GroupOptions): Promise<void>;
    /**
     * Send session replay events for visual playback.
     * @example verobase.analytics.sendReplayEvents("sess_abc", replayEvents)
     */
    sendReplayEvents(sessionId: string, events: unknown[]): Promise<void>;
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
    startReplay(options?: ReplayRecordOptions): (() => void);
    private _send;
}
//# sourceMappingURL=analytics.d.ts.map