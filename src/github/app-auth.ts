import { createPrivateKey, createSign, type KeyObject } from "node:crypto";
import { GitHubApiError } from "./client";

const GITHUB_API_URL = "https://api.github.com";
const GITHUB_API_VERSION = "2022-11-28";
const GITHUB_REQUEST_TIMEOUT_MS = 15_000;
const TOKEN_REFRESH_BUFFER_MS = 60_000;

type FetchImplementation = typeof fetch;

type InstallationTokenResponse = {
  token?: string;
  expires_at?: string;
};

type CachedToken = {
  token: string;
  expiresAtMs: number;
};

export class GitHubAppAuth {
  private readonly appId: string;
  private readonly installationId: string;
  private readonly privateKey: KeyObject;
  private readonly fetchImplementation: FetchImplementation;
  private readonly now: () => number;
  private cachedToken?: CachedToken;
  private inFlightToken?: Promise<string>;

  constructor(options: {
    appId: string;
    installationId: string;
    privateKeyBase64: string;
    fetch?: FetchImplementation;
    now?: () => number;
  }) {
    this.appId = options.appId;
    this.installationId = options.installationId;
    this.privateKey = createPrivateKey(decodePrivateKey(options.privateKeyBase64));
    this.fetchImplementation = options.fetch ?? fetch;
    this.now = options.now ?? Date.now;
  }

  async getInstallationToken(): Promise<string> {
    const now = this.now();

    if (this.cachedToken && now < this.cachedToken.expiresAtMs - TOKEN_REFRESH_BUFFER_MS) {
      return this.cachedToken.token;
    }

    if (this.inFlightToken) {
      return this.inFlightToken;
    }

    const request = this.requestInstallationToken(now);
    this.inFlightToken = request;

    try {
      return await request;
    } finally {
      if (this.inFlightToken === request) {
        this.inFlightToken = undefined;
      }
    }
  }

  private async requestInstallationToken(now: number): Promise<string> {
    const response = await this.fetchWithTimeout(now);

    if (!response.ok) {
      const bodyText = await response.text();
      throw new GitHubApiError({
        status: response.status,
        message: `Failed to create GitHub App installation token (${response.status} ${response.statusText}): ${bodyText || "empty response body"}`,
      });
    }

    const body = (await response.json()) as InstallationTokenResponse;

    if (!body.token || !body.expires_at) {
      throw new GitHubApiError({
        status: 502,
        message: "GitHub App installation token response missing required token or expires_at",
      });
    }

    const expiresAtMs = Date.parse(body.expires_at);

    if (Number.isNaN(expiresAtMs)) {
      throw new GitHubApiError({
        status: 502,
        message: `GitHub App installation token expires_at is invalid: ${body.expires_at}`,
      });
    }

    if (expiresAtMs <= now + TOKEN_REFRESH_BUFFER_MS) {
      throw new GitHubApiError({
        status: 502,
        message: `GitHub App installation token expires too soon: ${body.expires_at}`,
      });
    }

    this.cachedToken = {
      token: body.token,
      expiresAtMs,
    };

    return body.token;
  }

  private async fetchWithTimeout(now: number): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, GITHUB_REQUEST_TIMEOUT_MS);

    try {
      return await this.fetchImplementation(
        `${GITHUB_API_URL}/app/installations/${this.installationId}/access_tokens`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.createJwt(Math.floor(now / 1000))}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": GITHUB_API_VERSION,
          },
          signal: controller.signal,
        },
      );
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new GitHubApiError({
          status: 504,
          message: `GitHub App installation token request timed out after ${GITHUB_REQUEST_TIMEOUT_MS}ms`,
        });
      }

      throw new GitHubApiError({
        status: 502,
        message: `GitHub App installation token request failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private createJwt(nowSeconds: number): string {
    const header = encodeBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const payload = encodeBase64Url(
      JSON.stringify({
        iss: this.appId,
        iat: nowSeconds - 60,
        exp: nowSeconds + 600,
      }),
    );
    const unsignedToken = `${header}.${payload}`;
    const signer = createSign("RSA-SHA256");
    signer.update(unsignedToken);
    signer.end();

    const signature = signer.sign(this.privateKey);
    return `${unsignedToken}.${encodeBase64Url(signature)}`;
  }
}

function decodePrivateKey(privateKeyBase64: string): string {
  const normalized = privateKeyBase64.trim().replace(/\s/g, "");
  const decoded = Buffer.from(normalized, "base64").toString("utf8");
  const reencoded = Buffer.from(decoded, "utf8").toString("base64").replace(/=+$/g, "");
  const privateKeyPem = decoded.trim();

  if (!privateKeyPem || reencoded !== normalized.replace(/=+$/g, "")) {
    throw new Error("GITHUB_APP_PRIVATE_KEY_BASE64 must be a valid base64-encoded PEM private key");
  }

  return privateKeyPem;
}

function encodeBase64Url(value: string | Buffer): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
