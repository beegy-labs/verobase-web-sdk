import type { HttpClient } from "./http.js";
import type { TokenStorage } from "./types.js";
import type { ApiKeyResponse, BackupCodesResponse, ConsentRequest, ConsentResponse, CreateApiKeyRequest, CreateApiKeyResponse, GdprRequest, ServicePolicy, LoginResponse, LoginRequest, MfaLoginRequest, MfaSetupResponse, MfaStatusResponse, MfaVerifyRequest, OtpVerifyRequest, PasskeyAuthStartResponse, PasskeyCredential, PasskeyRegisterStartResponse, PasswordResetConfirmPayload, PasswordResetRequestPayload, RegisterRequest, SocialLoginResponse, SocialProvider, SsoProvider, TokenPair, VerifyEmailRequest } from "./types.js";
export declare class AuthModule {
    private readonly http;
    private readonly storage;
    private readonly serviceId;
    constructor(http: HttpClient, storage: TokenStorage, serviceId: string);
    private get base();
    /**
     * Register a new user. A verification email is sent automatically.
     * Returns the raw API response (no tokens yet; user must verify email first).
     */
    register(req: RegisterRequest): Promise<{
        message: string;
    }>;
    /**
     * Confirm email address with the token from the verification email.
     */
    verifyEmail(req: VerifyEmailRequest): Promise<{
        message: string;
    }>;
    /**
     * Login with email + password.
     *
     * If MFA is enabled, returns `{ mfa_required: true, mfa_token: "..." }` instead of tokens.
     * In that case, call `completeMfaLogin()` with the mfa_token and TOTP code.
     */
    login(req: LoginRequest): Promise<LoginResponse>;
    /**
     * Complete MFA login — exchange mfa_token + TOTP code for tokens.
     */
    completeMfaLogin(req: MfaLoginRequest): Promise<TokenPair>;
    /**
     * Silently rotate tokens using the stored refresh token.
     * Returns true on success, false if the session is expired/invalid.
     */
    refresh(): Promise<boolean>;
    /**
     * Logout the current user and clear local tokens.
     */
    logout(): Promise<void>;
    /**
     * Request a password-reset email.
     */
    requestPasswordReset(req: PasswordResetRequestPayload): Promise<{
        message: string;
    }>;
    /**
     * Confirm a password reset using the token from the email.
     */
    confirmPasswordReset(req: PasswordResetConfirmPayload): Promise<{
        message: string;
    }>;
    /** Returns the current access token, or null if not authenticated. */
    getAccessToken(): string | null;
    /** Returns true if there is a locally stored access token. */
    isAuthenticated(): boolean;
    /**
     * Start social login flow by redirecting to the provider's auth page.
     * After the user authenticates, the provider redirects back to `callbackUrl`.
     */
    socialLogin(provider: SocialProvider, callbackUrl?: string): void;
    /**
     * Handle the social login callback. Call this on your callback page.
     * Extracts `state` and `code` from URL params, exchanges for tokens.
     */
    handleCallback(params?: {
        state: string;
        code: string;
    }): Promise<SocialLoginResponse>;
    /** Start TOTP setup. Returns secret, QR URI, and backup codes. */
    setupMfa(): Promise<MfaSetupResponse>;
    /** Verify TOTP code to complete MFA setup. */
    verifyMfa(req: MfaVerifyRequest): Promise<void>;
    /** Check if MFA is enabled for the current user. */
    getMfaStatus(): Promise<MfaStatusResponse>;
    /** Disable MFA for the current user. */
    disableMfa(): Promise<void>;
    /** Regenerate backup codes. */
    regenerateBackupCodes(): Promise<BackupCodesResponse>;
    private get apiKeyBase();
    /**
     * Create a new API key. The `key` field in the response is shown **once only**.
     */
    createApiKey(req: CreateApiKeyRequest): Promise<CreateApiKeyResponse>;
    /** List all API keys for the current user (key values are never returned). */
    listApiKeys(): Promise<ApiKeyResponse[]>;
    /** Revoke an API key by ID. */
    revokeApiKey(keyId: string): Promise<void>;
    private get legalBase();
    /** Get current policies for the service. */
    getPolicies(): Promise<ServicePolicy[]>;
    /** Check which policies the user hasn't consented to yet. */
    getMissingConsents(): Promise<ServicePolicy[]>;
    /** Record user consent to a policy. */
    recordConsent(req: ConsentRequest): Promise<ConsentResponse>;
    /** Request data export (GDPR). */
    requestDataExport(): Promise<GdprRequest>;
    /** Request account deletion (GDPR). */
    requestAccountDeletion(): Promise<GdprRequest>;
    /** List user's GDPR requests. */
    getGdprRequests(): Promise<GdprRequest[]>;
    /**
     * Request a magic link to be sent to the user's email.
     */
    requestMagicLink(email: string): Promise<{
        message: string;
    }>;
    /**
     * Verify a magic link token (from email URL param `?token=...`).
     * On success, stores tokens and returns the token pair.
     */
    verifyMagicLink(token: string): Promise<TokenPair>;
    /**
     * Request a 6-digit OTP sent to the user's email.
     */
    requestOtp(email: string): Promise<{
        message: string;
    }>;
    /**
     * Verify the OTP code. On success, stores tokens and returns the token pair.
     */
    verifyOtp(req: OtpVerifyRequest): Promise<TokenPair>;
    /**
     * Start passkey registration. Returns WebAuthn PublicKeyCredentialCreationOptions.
     * Pass the result directly to `navigator.credentials.create()`.
     */
    passkeyRegisterStart(): Promise<PasskeyRegisterStartResponse>;
    /**
     * Finish passkey registration. Pass the credential from `navigator.credentials.create()`.
     */
    passkeyRegisterFinish(credential: unknown): Promise<void>;
    /**
     * Start passkey authentication for a given email.
     * Returns WebAuthn PublicKeyCredentialRequestOptions.
     */
    passkeyAuthStart(email: string): Promise<PasskeyAuthStartResponse>;
    /**
     * Finish passkey authentication. Pass the credential from `navigator.credentials.get()`.
     * On success, stores tokens.
     */
    passkeyAuthFinish(credential: unknown): Promise<TokenPair>;
    /** List registered passkeys for the current user. */
    listPasskeys(): Promise<PasskeyCredential[]>;
    /** Delete a passkey by credential ID. */
    deletePasskey(credId: string): Promise<void>;
    /** List available SSO providers for the service. */
    listSsoProviders(): Promise<SsoProvider[]>;
    /**
     * Get the SSO initiation URL for a given provider.
     * Redirect the user to this URL to start the SSO flow.
     */
    ssoInitiateUrl(providerId: string): string;
    /**
     * Handle the SSO callback. Call this on your SSO callback page.
     * Extracts `state` and `code` from URL params, completes the SSO flow.
     */
    handleSsoCallback(providerId: string, params?: {
        state: string;
        code: string;
    }): Promise<TokenPair>;
}
//# sourceMappingURL=auth.d.ts.map