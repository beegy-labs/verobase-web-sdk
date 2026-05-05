import type { HttpClient } from "./http.js";
import type { Platform, VersionCheckRequest, VersionCheckResponse } from "./types.js";

export class AppControlModule {
  constructor(
    private readonly http: HttpClient,
    private readonly serviceId: string,
  ) {}

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
  async checkVersion(req: VersionCheckRequest): Promise<VersionCheckResponse> {
    const params = new URLSearchParams({
      platform: req.platform,
      current_version: req.current_version,
    });
    return this.http.get<VersionCheckResponse>(
      `/v1/${this.serviceId}/app/version-check?${params}`,
      { auth: false },
    );
  }

  /**
   * Shorthand: returns true when a forced update is required.
   */
  async isForceUpdateRequired(platform: Platform, currentVersion: string): Promise<boolean> {
    const result = await this.checkVersion({ platform, current_version: currentVersion });
    return result.update_type === "FORCE";
  }

  /** Check maintenance mode status. */
  async checkMaintenance(): Promise<{ is_active: boolean; message: string | null; scheduled_start: string | null; scheduled_end: string | null }> {
    return this.http.get(`/v1/${this.serviceId}/app/maintenance`, { auth: false });
  }

  /** Get all remote config key-value pairs. */
  async getRemoteConfig(): Promise<Record<string, string>> {
    return this.http.get(`/v1/${this.serviceId}/app/config`, { auth: false });
  }

  /** Get feature flags as {key: boolean} map. */
  async getFeatures(): Promise<Record<string, boolean>> {
    return this.http.get(`/v1/${this.serviceId}/app/features`, { auth: false });
  }

  /** Get active notices (optionally filtered by platform/version). */
  async getNotices(platform?: string, version?: string): Promise<unknown[]> {
    const params = new URLSearchParams();
    if (platform) params.set("platform", platform);
    if (version) params.set("version", version);
    const qs = params.toString();
    return this.http.get(`/v1/${this.serviceId}/app/notices${qs ? `?${qs}` : ""}`, { auth: false });
  }

  /** Get latest active terms per type. */
  async getTerms(): Promise<unknown[]> {
    return this.http.get(`/v1/${this.serviceId}/app/terms`, { auth: false });
  }

  /** Record user agreement to a terms document. */
  async agreeToTerms(termsId: string): Promise<void> {
    await this.http.post(`/v1/${this.serviceId}/app/terms/${termsId}/agree`, undefined);
  }
}
