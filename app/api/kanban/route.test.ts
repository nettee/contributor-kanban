import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigError } from "../../../src/config";
import { GitHubApiError } from "../../../src/github/client";
import type { KanbanClient } from "../../../src/kanban/build-board";
import { clearCache } from "../../../src/server/cache";
import { createKanbanHandler } from "./handler";

const request = new Request("http://localhost/api/kanban");
const summaryRequest = new Request("http://localhost/api/kanban?summary=1");
const refreshRequest = new Request("http://localhost/api/kanban?refresh=1");

function emptyClient(): KanbanClient {
  return {
    listOpenPullRequests: vi.fn().mockResolvedValue([]),
    getPullRequest: vi.fn(),
    listPullRequestReviews: vi.fn(),
    listPullRequestCommits: vi.fn(),
    listIssueComments: vi.fn(),
    listCheckRuns: vi.fn(),
    listCommitStatuses: vi.fn(),
    getMembership: vi.fn(),
  };
}

describe("GET /api/kanban", () => {
  beforeEach(() => {
    clearCache();
  });

  afterEach(() => {
    clearCache();
    vi.useRealTimers();
  });

  it("returns configuration errors", async () => {
    const handler = createKanbanHandler({
      getConfig: () => {
        throw new ConfigError("Missing required environment variable: GITHUB_APP_ID");
      },
    });

    const response = await handler(request);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Configuration error",
      detail: "Missing required environment variable: GITHUB_APP_ID",
    });
  });

  it("returns GitHub API failures", async () => {
    const handler = createKanbanHandler({
      getConfig: () => ({ githubAppId: "1", githubAppInstallationId: "2", githubAppPrivateKeyBase64: "a2V5", githubOwner: "o", githubRepo: "r", githubOrg: "org", githubRequestConcurrency: 1 }),
      createClient: () => ({
        ...emptyClient(),
        listOpenPullRequests: vi.fn().mockRejectedValue(
          new GitHubApiError({
            status: 429,
            message: "rate limited",
            retryAt: "2026-05-12T10:02:00.000Z",
            rateLimit: { limit: 5000, remaining: 0, resetAt: "2026-05-12T10:10:00.000Z" },
          }),
        ),
      }),
    });

    const response = await handler(request);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "GitHub API error",
      detail: "rate limited",
      retryAt: "2026-05-12T10:02:00.000Z",
      rateLimit: { limit: 5000, remaining: 0, resetAt: "2026-05-12T10:10:00.000Z" },
    });
  });

  it("returns successful board responses", async () => {
    const handler = createKanbanHandler({
      getConfig: () => ({ githubAppId: "1", githubAppInstallationId: "2", githubAppPrivateKeyBase64: "a2V5", githubOwner: "o", githubRepo: "r", githubOrg: "org", githubRequestConcurrency: 1 }),
      createClient: emptyClient,
    });

    const response = await handler(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=3600");
    expect(body.repository).toBe("o/r");
    expect(body.columns.map((column: { id: string }) => column.id)).toEqual(["A", "B", "C", "D", "E"]);
    expect(body.refreshedAt).toEqual(expect.any(String));
  });

  it("reuses cached detail responses within the TTL", async () => {
    vi.useFakeTimers();

    const client = emptyClient();
    const handler = createKanbanHandler({
      getConfig: () => ({ githubAppId: "1", githubAppInstallationId: "2", githubAppPrivateKeyBase64: "a2V5", githubOwner: "o", githubRepo: "r", githubOrg: "org", githubRequestConcurrency: 1 }),
      createClient: () => client,
    });

    const firstResponse = await handler(request);
    vi.advanceTimersByTime(30_000);
    const secondResponse = await handler(request);

    expect(client.listOpenPullRequests).toHaveBeenCalledTimes(1);
    await expect(firstResponse.json()).resolves.toEqual(await secondResponse.json());
  });

  it("uses separate cache keys for summary and detail responses", async () => {
    vi.useFakeTimers();

    const client = emptyClient();
    const handler = createKanbanHandler({
      getConfig: () => ({ githubAppId: "1", githubAppInstallationId: "2", githubAppPrivateKeyBase64: "a2V5", githubOwner: "o", githubRepo: "r", githubOrg: "org", githubRequestConcurrency: 1 }),
      createClient: () => client,
    });

    await handler(summaryRequest);
    await handler(request);
    await handler(summaryRequest);
    await handler(request);

    expect(client.listOpenPullRequests).toHaveBeenCalledTimes(2);
  });

  it("fetches a new response after the cache TTL expires", async () => {
    vi.useFakeTimers();

    const client = emptyClient();
    const handler = createKanbanHandler({
      getConfig: () => ({ githubAppId: "1", githubAppInstallationId: "2", githubAppPrivateKeyBase64: "a2V5", githubOwner: "o", githubRepo: "r", githubOrg: "org", githubRequestConcurrency: 1 }),
      createClient: () => client,
    });

    const firstResponse = await handler(request);
    vi.advanceTimersByTime(60 * 60_000);
    const secondResponse = await handler(request);

    expect(client.listOpenPullRequests).toHaveBeenCalledTimes(2);
    await expect(firstResponse.json()).resolves.not.toEqual(await secondResponse.json());
  });

  it("refreshes and replaces cached detail responses when requested", async () => {
    vi.useFakeTimers();

    const client = emptyClient();
    const handler = createKanbanHandler({
      getConfig: () => ({ githubAppId: "1", githubAppInstallationId: "2", githubAppPrivateKeyBase64: "a2V5", githubOwner: "o", githubRepo: "r", githubOrg: "org", githubRequestConcurrency: 1 }),
      createClient: () => client,
    });

    const firstResponse = await handler(request);
    vi.advanceTimersByTime(30_000);
    const refreshResponse = await handler(refreshRequest);
    const cachedAfterRefreshResponse = await handler(request);

    expect(client.listOpenPullRequests).toHaveBeenCalledTimes(2);
    expect(refreshResponse.headers.get("Cache-Control")).toBe("no-store");
    await expect(refreshResponse.json()).resolves.toEqual(await cachedAfterRefreshResponse.json());
    await expect(firstResponse.json()).resolves.not.toEqual(await handler(request).then((response) => response.json()));
  });

  it("repopulates the data cache on production refresh requests", async () => {
    vi.resetModules();

    const responses = [
      { repository: "o/r", columns: [], refreshedAt: "initial" },
      { repository: "o/r", columns: [], refreshedAt: "refreshed" },
    ];
    let responseIndex = 0;
    const buildKanbanResponse = vi.fn().mockImplementation(async () => responses[responseIndex++]);

    vi.doMock("next/cache", () => {
      const cacheEntries = new Map<string, unknown>();
      const tagEntries = new Map<string, Set<string>>();

      return {
        unstable_cache: (fn: (cacheScope: string) => Promise<unknown>, keyParts: string[], options?: { tags?: string[] }) => {
          return async (cacheScope: string) => {
            const cacheKey = `${keyParts.join(":")}:${cacheScope}`;
            if (cacheEntries.has(cacheKey)) {
              return cacheEntries.get(cacheKey);
            }

            const value = await fn(cacheScope);
            cacheEntries.set(cacheKey, value);

            for (const tag of options?.tags ?? []) {
              const keys = tagEntries.get(tag) ?? new Set<string>();
              keys.add(cacheKey);
              tagEntries.set(tag, keys);
            }

            return value;
          };
        },
        revalidateTag: (tag: string) => {
          for (const key of tagEntries.get(tag) ?? []) {
            cacheEntries.delete(key);
          }
        },
      };
    });

    vi.doMock("@/src/config", () => ({
      ConfigError: class ConfigError extends Error {},
      getServerConfig: () => ({
        githubAppId: "1",
        githubAppInstallationId: "2",
        githubAppPrivateKeyBase64: "a2V5",
        githubOwner: "o",
        githubRepo: "r",
        githubOrg: "org",
        githubRequestConcurrency: 1,
      }),
    }));
    vi.doMock("@/src/github/app-auth", () => ({
      GitHubAppAuth: class {
        getInstallationToken() {
          return Promise.resolve("token");
        }
      },
    }));
    vi.doMock("@/src/github/client", () => ({
      GitHubApiError: class GitHubApiError extends Error {},
      GitHubRestClient: class {},
    }));
    vi.doMock("@/src/kanban/build-board", () => ({
      buildKanbanResponse,
      buildKanbanSummaryResponse: vi.fn(),
    }));

    const { createKanbanHandler: createProductionHandler } = await import("./handler");
    const handler = createProductionHandler();

    const firstResponse = await handler(request);
    const refreshResponse = await handler(refreshRequest);
    const cachedAfterRefreshResponse = await handler(request);

    await expect(firstResponse.json()).resolves.toEqual(responses[0]);
    expect(refreshResponse.headers.get("Cache-Control")).toBe("no-store");
    await expect(refreshResponse.json()).resolves.toEqual(responses[1]);
    await expect(cachedAfterRefreshResponse.json()).resolves.toEqual(responses[1]);
    expect(buildKanbanResponse).toHaveBeenCalledTimes(2);
  });

  it("awaits async client factories", async () => {
    const client = emptyClient();
    const handler = createKanbanHandler({
      getConfig: () => ({ githubAppId: "1", githubAppInstallationId: "2", githubAppPrivateKeyBase64: "a2V5", githubOwner: "o", githubRepo: "r", githubOrg: "org", githubRequestConcurrency: 1 }),
      createClient: async () => client,
    });

    const response = await handler(request);

    expect(response.status).toBe(200);
    expect(client.listOpenPullRequests).toHaveBeenCalledTimes(1);
  });
});
