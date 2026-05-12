import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigError } from "../../../src/config";
import { GitHubApiError } from "../../../src/github/client";
import type { KanbanClient } from "../../../src/kanban/build-board";
import { clearCache } from "../../../src/server/cache";
import { createKanbanHandler } from "./handler";

const request = new Request("http://localhost/api/kanban");
const summaryRequest = new Request("http://localhost/api/kanban?summary=1");

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
        throw new ConfigError("Missing required environment variable: GITHUB_TOKEN");
      },
    });

    const response = await handler(request);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Configuration error",
      detail: "Missing required environment variable: GITHUB_TOKEN",
    });
  });

  it("returns GitHub API failures", async () => {
    const handler = createKanbanHandler({
      getConfig: () => ({ githubToken: "t", githubOwner: "o", githubRepo: "r", githubOrg: "org", githubRequestConcurrency: 1 }),
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
      getConfig: () => ({ githubToken: "t", githubOwner: "o", githubRepo: "r", githubOrg: "org", githubRequestConcurrency: 1 }),
      createClient: emptyClient,
    });

    const response = await handler(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.columns.map((column: { id: string }) => column.id)).toEqual(["A", "B", "C", "D", "E"]);
    expect(body.refreshedAt).toEqual(expect.any(String));
  });

  it("reuses cached detail responses within the TTL", async () => {
    vi.useFakeTimers();

    const client = emptyClient();
    const handler = createKanbanHandler({
      getConfig: () => ({ githubToken: "t", githubOwner: "o", githubRepo: "r", githubOrg: "org", githubRequestConcurrency: 1 }),
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
      getConfig: () => ({ githubToken: "t", githubOwner: "o", githubRepo: "r", githubOrg: "org", githubRequestConcurrency: 1 }),
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
      getConfig: () => ({ githubToken: "t", githubOwner: "o", githubRepo: "r", githubOrg: "org", githubRequestConcurrency: 1 }),
      createClient: () => client,
    });

    const firstResponse = await handler(request);
    vi.advanceTimersByTime(60_000);
    const secondResponse = await handler(request);

    expect(client.listOpenPullRequests).toHaveBeenCalledTimes(2);
    await expect(firstResponse.json()).resolves.not.toEqual(await secondResponse.json());
  });
});
