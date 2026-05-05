import type { HttpClient } from "./http.js";
import type { Platform, VersionCheckRequest, VersionCheckResponse } from "./types.js";
export declare class AppControlModule {
    private readonly http;
    private readonly serviceId;
    constructor(http: HttpClient, serviceId: string);
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
    checkVersion(req: VersionCheckRequest): Promise<VersionCheckResponse>;
    /**
     * Shorthand: returns true when a forced update is required.
     */
    isForceUpdateRequired(platform: Platform, currentVersion: string): Promise<boolean>;
    /** Check maintenance mode status. */
    checkMaintenance(): Promise<{
        is_active: boolean;
        message: string | null;
        scheduled_start: string | null;
        scheduled_end: string | null;
    }>;
    /** Get all remote config key-value pairs. */
    getRemoteConfig(): Promise<Record<string, string>>;
    /** Get feature flags as {key: boolean} map. */
    getFeatures(): Promise<Record<string, boolean>>;
    /** Get active notices (optionally filtered by platform/version). */
    getNotices(platform?: string, version?: string): Promise<unknown[]>;
    /** Get latest active terms per type. */
    getTerms(): Promise<unknown[]>;
    /** Record user agreement to a terms document. */
    agreeToTerms(termsId: string): Promise<void>;
}
//# sourceMappingURL=app-control.d.ts.map