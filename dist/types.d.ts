export interface VerobaseConfig {
    /** Base URL of the verobase-api instance, e.g. "https://api.example.com" */
    baseUrl: string;
    /** Service UUID registered in Verobase */
    serviceId: string;
    /** Storage backend for tokens. Defaults to "localStorage". Use "memory" for SSR/Tauri. */
    storage?: "localStorage" | "sessionStorage" | "memory";
}
export interface TokenPair {
    access_token: string;
    refresh_token: string;
    expires_in: number;
}
/** Login may return tokens or require MFA */
export interface LoginResponse {
    access_token?: string;
    refresh_token?: string;
    token_type?: string;
    mfa_required?: boolean;
    mfa_token?: string;
}
export interface MfaLoginRequest {
    mfa_token: string;
    code: string;
}
export interface RegisterRequest {
    email: string;
    password: string;
}
export interface LoginRequest {
    email: string;
    password: string;
}
export interface VerifyEmailRequest {
    token: string;
}
export interface PasswordResetRequestPayload {
    email: string;
}
export interface PasswordResetConfirmPayload {
    token: string;
    new_password: string;
}
export type Platform = "ios" | "android" | "windows" | "macos" | "linux" | "web";
export type UpdateType = "FORCE" | "RECOMMEND" | "NONE";
export interface VersionCheckRequest {
    platform: Platform;
    current_version: string;
}
export interface VersionCheckResponse {
    platform: Platform;
    current_version: string;
    latest_version: string;
    update_type: UpdateType;
    store_url: string | null;
    release_notes: string | null;
    message: {
        title: string;
        body: string;
    };
}
export type SocialProvider = "google" | "apple" | "kakao" | "naver";
export interface SocialLoginResponse {
    access_token: string;
    refresh_token: string;
    token_type: string;
    user_id: string;
    is_new_user: boolean;
}
export interface MfaSetupResponse {
    secret: string;
    otpauth_uri: string;
    backup_codes: string[];
}
export interface MfaStatusResponse {
    enabled: boolean;
}
export interface MfaVerifyRequest {
    code: string;
}
export interface BackupCodesResponse {
    backup_codes: string[];
}
export interface CreateApiKeyRequest {
    name: string;
    scopes?: string[];
    expires_at?: string;
}
/** Returned only on creation — `key` is shown once */
export interface CreateApiKeyResponse {
    id: string;
    name: string;
    key: string;
    prefix: string;
    scopes: string[];
    expires_at: string | null;
    created_at: string;
}
export interface ApiKeyResponse {
    id: string;
    name: string;
    prefix: string;
    scopes: string[];
    expires_at: string | null;
    last_used_at: string | null;
    revoked_at: string | null;
    created_at: string;
}
export interface ServicePolicy {
    id: string;
    service_id: string;
    policy_type: string;
    version: string;
    url: string;
    is_current: boolean;
    requires_consent: boolean;
    created_at: string;
}
export interface ConsentRequest {
    policy_id: string;
}
export interface ConsentResponse {
    id: string;
    policy_id: string;
    consented_at: string;
}
export interface GdprRequest {
    id: string;
    request_type: string;
    status: string;
    completed_at: string | null;
    created_at: string;
}
export interface TrackEventPayload {
    /** Custom event name */
    name: string;
    /** Arbitrary event properties (JSON-serialisable) */
    props?: Record<string, unknown>;
    /** Revenue amount associated with this event */
    revenue?: number;
    /** ISO 4217 currency code, e.g. "USD", "KRW" */
    currency?: string;
}
export interface GroupOptions {
    groupId: string;
    groupType: string;
    properties?: Record<string, unknown>;
}
export interface ReplayEvent {
    type: number | string;
    timestamp: string;
    [key: string]: unknown;
}
/** Options for session replay recording. maskAllInputs is always forced to true. */
export interface ReplayRecordOptions {
    /** CSS selector for additional text masking (e.g. ".pii", ".credit-card") */
    maskTextSelector?: string;
    /** CSS selector for elements to block entirely (replaced with placeholder) */
    blockSelector?: string;
    /** Mask specific input types beyond the defaults (password/email/tel are always masked) */
    maskInputOptions?: Record<string, boolean>;
    /** Custom function to transform masked input text */
    maskInputFn?: (text: string) => string;
    /** Custom function to transform masked display text */
    maskTextFn?: (text: string) => string;
    /** Sampling configuration for mouse movement events */
    sampling?: {
        mousemove?: boolean;
        scroll?: number;
    };
}
export interface PageviewPayload {
    pathname?: string;
    page_title?: string;
    referrer?: string;
    screen_width?: number;
    screen_height?: number;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_term?: string;
    utm_content?: string;
}
export interface ScreenviewPayload {
    screen_name: string;
    props?: Record<string, unknown>;
}
export interface UserPropertiesPayload {
    [key: string]: unknown;
}
export interface CwvPayload {
    metric_name: "LCP" | "INP" | "CLS" | "FCP" | "TTFB";
    value: number;
    rating: "good" | "needs-improvement" | "poor";
    pathname?: string;
}
export interface PasskeyRegisterStartResponse {
    challenge: string;
    user: {
        id: string;
        name: string;
        displayName: string;
    };
    rp: {
        name: string;
        id: string;
    };
    pubKeyCredParams: Array<{
        type: string;
        alg: number;
    }>;
    timeout: number;
    attestation: string;
}
export interface PasskeyAuthStartResponse {
    challenge: string;
    allowCredentials: Array<{
        type: string;
        id: string;
    }>;
    timeout: number;
    userVerification: string;
}
export interface PasskeyCredential {
    id: string;
    name: string | null;
    aaguid: string | null;
    created_at: string;
    last_used_at: string | null;
}
export interface SsoProvider {
    id: string;
    name: string;
    provider_type: "oidc" | "saml";
}
export interface OtpVerifyRequest {
    email: string;
    code: string;
}
export interface TokenStorage {
    getAccessToken(): string | null;
    getRefreshToken(): string | null;
    setTokens(pair: TokenPair): void;
    clearTokens(): void;
}
//# sourceMappingURL=types.d.ts.map