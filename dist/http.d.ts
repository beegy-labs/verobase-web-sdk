import type { TokenStorage } from "./types.js";
export declare class ApiError extends Error {
    readonly status: number;
    readonly body: unknown;
    constructor(status: number, body: unknown);
}
type RefreshFn = () => Promise<boolean>;
export declare class HttpClient {
    private readonly baseUrl;
    private readonly storage;
    private refreshFn;
    private refreshInFlight;
    constructor(baseUrl: string, storage: TokenStorage);
    setRefreshFn(fn: RefreshFn): void;
    request<T>(method: string, path: string, body?: unknown, opts?: {
        auth?: boolean;
        skipRefresh?: boolean;
    }): Promise<T>;
    get<T>(path: string, opts?: {
        auth?: boolean;
    }): Promise<T>;
    post<T>(path: string, body?: unknown, opts?: {
        auth?: boolean;
        skipRefresh?: boolean;
    }): Promise<T>;
    delete<T>(path: string, opts?: {
        auth?: boolean;
    }): Promise<T>;
}
export {};
//# sourceMappingURL=http.d.ts.map