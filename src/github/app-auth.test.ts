import { generateKeyPairSync } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GitHubAppAuth } from "./app-auth";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const privateKeyBase64 = Buffer.from(
  privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  "utf8",
).toString("base64");

describe("GitHubAppAuth", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("requests an installation token with a RS256 bearer JWT", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ token: "installation-token", expires_at: "2026-05-12T11:00:00.000Z" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const auth = new GitHubAppAuth({
      appId: "12345",
      installationId: "67890",
      privateKeyBase64,
      fetch: fetchImplementation,
      now: () => Date.parse("2026-05-12T10:00:00.000Z"),
    });

    await expect(auth.getInstallationToken()).resolves.toBe("installation-token");

    expect(fetchImplementation).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImplementation.mock.calls[0];
    expect(url).toBe("https://api.github.com/app/installations/67890/access_tokens");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    });

    const authorization = (init?.headers as Record<string, string>).Authorization;
    expect(authorization.startsWith("Bearer ")).toBe(true);

    const jwt = authorization.slice("Bearer ".length);
    const [encodedHeader, encodedPayload] = jwt.split(".");
    const header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf8"));
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));

    expect(header.alg).toBe("RS256");
    expect(payload).toMatchObject({
      iss: "12345",
      iat: Math.floor(Date.parse("2026-05-12T10:00:00.000Z") / 1000) - 60,
      exp: Math.floor(Date.parse("2026-05-12T10:00:00.000Z") / 1000) + 600,
    });
  });

  it("reuses a cached token before the refresh window", async () => {
    const now = vi.fn<() => number>()
      .mockReturnValueOnce(Date.parse("2026-05-12T10:00:00.000Z"))
      .mockReturnValueOnce(Date.parse("2026-05-12T10:10:00.000Z"));
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ token: "cached-token", expires_at: "2026-05-12T10:30:00.000Z" }), { status: 201 }));

    const auth = new GitHubAppAuth({ appId: "12345", installationId: "67890", privateKeyBase64, fetch: fetchImplementation, now });

    await expect(auth.getInstallationToken()).resolves.toBe("cached-token");
    await expect(auth.getInstallationToken()).resolves.toBe("cached-token");

    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });

  it("refreshes the token within sixty seconds of expiration", async () => {
    const now = vi.fn<() => number>()
      .mockReturnValueOnce(Date.parse("2026-05-12T10:00:00.000Z"))
      .mockReturnValueOnce(Date.parse("2026-05-12T10:04:01.000Z"));
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: "first-token", expires_at: "2026-05-12T10:05:00.000Z" }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: "second-token", expires_at: "2026-05-12T10:10:00.000Z" }), { status: 201 }));

    const auth = new GitHubAppAuth({ appId: "12345", installationId: "67890", privateKeyBase64, fetch: fetchImplementation, now });

    await expect(auth.getInstallationToken()).resolves.toBe("first-token");
    await expect(auth.getInstallationToken()).resolves.toBe("second-token");

    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });

  it("throws when GitHub returns a non-2xx response", async () => {
    const auth = new GitHubAppAuth({
      appId: "12345",
      installationId: "67890",
      privateKeyBase64,
      fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response("bad credentials", { status: 401, statusText: "Unauthorized" })),
    });

    await expect(auth.getInstallationToken()).rejects.toThrow(
      "Failed to create GitHub App installation token (401 Unauthorized): bad credentials",
    );
  });
});
