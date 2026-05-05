import { AnalyticsModule } from "./analytics.js";
import { AppControlModule } from "./app-control.js";
import { AuthModule } from "./auth.js";
import type { VerobaseConfig } from "./types.js";
export declare class VerobaseClient {
    readonly auth: AuthModule;
    readonly appControl: AppControlModule;
    readonly analytics: AnalyticsModule;
    private readonly http;
    constructor(config: VerobaseConfig);
}
/**
 * Initialise the global Verobase client. Call once at app startup.
 *
 * @example
 * import { init, verobase } from "@verobase/web-sdk";
 *
 * init({ baseUrl: "https://api.example.com", serviceId: "..." });
 * await verobase.auth.login({ email, password });
 */
export declare function init(config: VerobaseConfig): VerobaseClient;
/**
 * The global Verobase client instance. Must call `init()` first.
 */
export declare const verobase: VerobaseClient;
//# sourceMappingURL=client.d.ts.map