import type { HttpClient } from "./http.js";
import type { TokenStorage } from "./types.js";
import type {
  ApiKeyResponse,
  BackupCodesResponse,
  ConsentRequest,
  ConsentResponse,
  CreateApiKeyRequest,
  CreateApiKeyResponse,
  GdprRequest,
  ServicePolicy,
  LoginResponse,
  LoginRequest,
  MfaLoginRequest,
  MfaSetupResponse,
  MfaStatusResponse,
  MfaVerifyRequest,
  OtpVerifyRequest,
  PasskeyAuthStartResponse,
  PasskeyCredential,
  PasskeyRegisterStartResponse,
  PasswordResetConfirmPayload,
  PasswordResetRequestPayload,
  RegisterRequest,
  SocialLoginResponse,
  SocialProvider,
  SsoProvider,
  TokenPair,
  VerifyEmailRequest,
} from "./types.js";

export class AuthModule {
  constructor(
    private readonly http: HttpClient,
    private readonly storage: TokenStorage,
    private readonly serviceId: string,
  ) {}

  // Empty serviceId = single-tenant or publishable-key mode → clean URLs.
  // Non-empty = legacy /v1/{service_id}/auth/* form.
  private get base() {
    return this.serviceId ? `/v1/${this.serviceId}/auth` : `/v1/auth`;
  }

  /**
   * Register a new user. A verification email is sent automatically.
   * Returns the raw API response (no tokens yet; user must verify email first).
   */
  async register(req: RegisterRequest): Promise<{ message: string }> {
    return this.http.post(`${this.base}/register`, req, { auth: false });
  }

  /**
   * Confirm email address with the token from the verification email.
   */
  async verifyEmail(req: VerifyEmailRequest): Promise<{ message: string }> {
    return this.http.post(`${this.base}/verify-email`, req, { auth: false });
  }

  /**
   * Login with email + password.
   *
   * If MFA is enabled, returns `{ mfa_required: true, mfa_token: "..." }` instead of tokens.
   * In that case, call `completeMfaLogin()` with the mfa_token and TOTP code.
   */
  async login(req: LoginRequest): Promise<LoginResponse> {
    const resp = await this.http.post<LoginResponse>(`${this.base}/login`, req, { auth: false });
    if (resp.access_token && resp.refresh_token) {
      this.storage.setTokens({
        access_token: resp.access_token,
        refresh_token: resp.refresh_token,
        expires_in: 900,
      });
    }
    return resp;
  }

  /**
   * Complete MFA login — exchange mfa_token + TOTP code for tokens.
   */
  async completeMfaLogin(req: MfaLoginRequest): Promise<TokenPair> {
    const pair = await this.http.post<TokenPair>(`${this.base}/login/mfa`, req, { auth: false });
    this.storage.setTokens(pair);
    return pair;
  }

  /**
   * Silently rotate tokens using the stored refresh token.
   * Returns true on success, false if the session is expired/invalid.
   */
  async refresh(): Promise<boolean> {
    const refreshToken = this.storage.getRefreshToken();
    if (!refreshToken) return false;
    try {
      const pair = await this.http.post<TokenPair>(
        `${this.base}/refresh`,
        { refresh_token: refreshToken },
        { auth: false, skipRefresh: true },
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
  async logout(): Promise<void> {
    try {
      await this.http.post(`${this.base}/logout`, undefined, { auth: true });
    } finally {
      this.storage.clearTokens();
    }
  }

  /**
   * Request a password-reset email.
   */
  async requestPasswordReset(req: PasswordResetRequestPayload): Promise<{ message: string }> {
    return this.http.post(`${this.base}/password-reset/request`, req, { auth: false });
  }

  /**
   * Confirm a password reset using the token from the email.
   */
  async confirmPasswordReset(req: PasswordResetConfirmPayload): Promise<{ message: string }> {
    return this.http.post(`${this.base}/password-reset/confirm`, req, { auth: false });
  }

  /** Returns the current access token, or null if not authenticated. */
  getAccessToken(): string | null {
    return this.storage.getAccessToken();
  }

  /** Returns true if there is a locally stored access token. */
  isAuthenticated(): boolean {
    return this.storage.getAccessToken() !== null;
  }

  // ── Social Login ─────────────────────────────────────────────────

  /**
   * Start social login flow by redirecting to the provider's auth page.
   * After the user authenticates, the provider redirects back to `callbackUrl`.
   */
  socialLogin(provider: SocialProvider, callbackUrl?: string): void {
    const cb = callbackUrl ?? `${window.location.origin}/auth/callback`;
    const url = `${this.http["baseUrl"]}${this.base}/social/${provider}?callback_url=${encodeURIComponent(cb)}`;
    window.location.href = url;
  }

  /**
   * Handle the social login callback. Call this on your callback page.
   * Extracts `state` and `code` from URL params, exchanges for tokens.
   */
  async handleCallback(params?: { state: string; code: string }): Promise<SocialLoginResponse> {
    const p = params ?? parseCallbackParams();
    const resp = await this.http.get<SocialLoginResponse>(
      `${this.base}/social/callback?state=${encodeURIComponent(p.state)}&code=${encodeURIComponent(p.code)}`,
      { auth: false },
    );
    this.storage.setTokens({
      access_token: resp.access_token,
      refresh_token: resp.refresh_token,
      expires_in: 900,
    });
    return resp;
  }

  // ── MFA ──────────────────────────────────────────────────────────

  /** Start TOTP setup. Returns secret, QR URI, and backup codes. */
  async setupMfa(): Promise<MfaSetupResponse> {
    return this.http.post(`${this.base}/mfa/setup`, undefined, { auth: true });
  }

  /** Verify TOTP code to complete MFA setup. */
  async verifyMfa(req: MfaVerifyRequest): Promise<void> {
    return this.http.post(`${this.base}/mfa/verify`, req, { auth: true });
  }

  /** Check if MFA is enabled for the current user. */
  async getMfaStatus(): Promise<MfaStatusResponse> {
    return this.http.get(`${this.base}/mfa/status`, { auth: true });
  }

  /** Disable MFA for the current user. */
  async disableMfa(): Promise<void> {
    return this.http.delete(`${this.base}/mfa`, { auth: true });
  }

  /** Regenerate backup codes. */
  async regenerateBackupCodes(): Promise<BackupCodesResponse> {
    return this.http.post(`${this.base}/mfa/backup-codes`, undefined, { auth: true });
  }

  // ── API Keys ─────────────────────────────────────────────────────

  private get apiKeyBase() {
    return this.serviceId ? `/v1/${this.serviceId}/api-keys` : `/v1/api-keys`;
  }

  /**
   * Create a new API key. The `key` field in the response is shown **once only**.
   */
  async createApiKey(req: CreateApiKeyRequest): Promise<CreateApiKeyResponse> {
    return this.http.post(this.apiKeyBase, req, { auth: true });
  }

  /** List all API keys for the current user (key values are never returned). */
  async listApiKeys(): Promise<ApiKeyResponse[]> {
    return this.http.get(this.apiKeyBase, { auth: true });
  }

  /** Revoke an API key by ID. */
  async revokeApiKey(keyId: string): Promise<void> {
    return this.http.delete(`${this.apiKeyBase}/${keyId}`, { auth: true });
  }

  // ── Legal / GDPR ─────────────────────────────────────────────────

  private get legalBase() {
    return this.serviceId ? `/v1/${this.serviceId}` : `/v1`;
  }

  /** Get current policies for the service. */
  async getPolicies(): Promise<ServicePolicy[]> {
    return this.http.get(`${this.legalBase}/policies`, { auth: false });
  }

  /** Check which policies the user hasn't consented to yet. */
  async getMissingConsents(): Promise<ServicePolicy[]> {
    return this.http.get(`${this.legalBase}/consent/missing`, { auth: true });
  }

  /** Record user consent to a policy. */
  async recordConsent(req: ConsentRequest): Promise<ConsentResponse> {
    return this.http.post(`${this.legalBase}/consent`, req, { auth: true });
  }

  /** Request data export (GDPR). */
  async requestDataExport(): Promise<GdprRequest> {
    return this.http.post(`${this.legalBase}/gdpr`, { request_type: "export" }, { auth: true });
  }

  /** Request account deletion (GDPR). */
  async requestAccountDeletion(): Promise<GdprRequest> {
    return this.http.post(`${this.legalBase}/gdpr`, { request_type: "deletion" }, { auth: true });
  }

  /** List user's GDPR requests. */
  async getGdprRequests(): Promise<GdprRequest[]> {
    return this.http.get(`${this.legalBase}/gdpr`, { auth: true });
  }

  // ── Passwordless ─────────────────────────────────────────────────

  /**
   * Request a magic link to be sent to the user's email.
   */
  async requestMagicLink(email: string): Promise<{ message: string }> {
    return this.http.post(`${this.base}/magic-link`, { email }, { auth: false });
  }

  /**
   * Verify a magic link token (from email URL param `?token=...`).
   * On success, stores tokens and returns the token pair.
   */
  async verifyMagicLink(token: string): Promise<TokenPair> {
    const pair = await this.http.post<TokenPair>(`${this.base}/magic-link/verify`, { token }, { auth: false });
    this.storage.setTokens(pair);
    return pair;
  }

  /**
   * Request a 6-digit OTP sent to the user's email.
   */
  async requestOtp(email: string): Promise<{ message: string }> {
    return this.http.post(`${this.base}/otp`, { email }, { auth: false });
  }

  /**
   * Verify the OTP code. On success, stores tokens and returns the token pair.
   */
  async verifyOtp(req: OtpVerifyRequest): Promise<TokenPair> {
    const pair = await this.http.post<TokenPair>(`${this.base}/otp/verify`, req, { auth: false });
    this.storage.setTokens(pair);
    return pair;
  }

  // ── Passkeys ─────────────────────────────────────────────────────

  /**
   * Start passkey registration. Returns WebAuthn PublicKeyCredentialCreationOptions.
   * Pass the result directly to `navigator.credentials.create()`.
   */
  async passkeyRegisterStart(): Promise<PasskeyRegisterStartResponse> {
    return this.http.post(`${this.base}/passkey/register/start`, undefined, { auth: true });
  }

  /**
   * Finish passkey registration. Pass the credential from `navigator.credentials.create()`.
   */
  async passkeyRegisterFinish(credential: unknown): Promise<void> {
    return this.http.post(`${this.base}/passkey/register/finish`, credential, { auth: true });
  }

  /**
   * Start passkey authentication for a given email.
   * Returns WebAuthn PublicKeyCredentialRequestOptions.
   */
  async passkeyAuthStart(email: string): Promise<PasskeyAuthStartResponse> {
    return this.http.post(`${this.base}/passkey/auth/start`, { email }, { auth: false });
  }

  /**
   * Finish passkey authentication. Pass the credential from `navigator.credentials.get()`.
   * On success, stores tokens.
   */
  async passkeyAuthFinish(credential: unknown): Promise<TokenPair> {
    const pair = await this.http.post<TokenPair>(`${this.base}/passkey/auth/finish`, credential, { auth: false });
    this.storage.setTokens(pair);
    return pair;
  }

  /** List registered passkeys for the current user. */
  async listPasskeys(): Promise<PasskeyCredential[]> {
    return this.http.get(`${this.base}/passkey`, { auth: true });
  }

  /** Delete a passkey by credential ID. */
  async deletePasskey(credId: string): Promise<void> {
    return this.http.delete(`${this.base}/passkey/${credId}`, { auth: true });
  }

  // ── SSO ──────────────────────────────────────────────────────────

  /** List available SSO providers for the service. */
  async listSsoProviders(): Promise<SsoProvider[]> {
    return this.http.get(`${this.base}/sso`, { auth: false });
  }

  /**
   * Get the SSO initiation URL for a given provider.
   * Redirect the user to this URL to start the SSO flow.
   */
  ssoInitiateUrl(providerId: string): string {
    return `${this.http["baseUrl"]}${this.base}/sso/${providerId}/initiate`;
  }

  /**
   * Handle the SSO callback. Call this on your SSO callback page.
   * Extracts `state` and `code` from URL params, completes the SSO flow.
   */
  async handleSsoCallback(providerId: string, params?: { state: string; code: string }): Promise<TokenPair> {
    const p = params ?? parseSsoCallbackParams();
    const pair = await this.http.get<TokenPair>(
      `${this.base}/sso/${providerId}/callback?state=${encodeURIComponent(p.state)}&code=${encodeURIComponent(p.code)}`,
      { auth: false },
    );
    this.storage.setTokens(pair);
    return pair;
  }
}

function parseCallbackParams(): { state: string; code: string } {
  const params = new URLSearchParams(window.location.search);
  const state = params.get("state");
  const code = params.get("code");
  if (!state || !code) {
    throw new Error("Missing state or code in callback URL");
  }
  return { state, code };
}

function parseSsoCallbackParams(): { state: string; code: string } {
  const params = new URLSearchParams(window.location.search);
  const state = params.get("state");
  const code = params.get("code");
  if (!state || !code) throw new Error("Missing state or code in SSO callback URL");
  return { state, code };
}
