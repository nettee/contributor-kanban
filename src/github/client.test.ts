import { describe, expect, it, vi } from "vitest";
import { GitHubApiError, GitHubRestClient } from "./client";
import { RequestQueue } from "./queue";

function createClient(fetchImplementation: typeof fetch) {
  return new GitHubRestClient({
    token: "token",
    owner: "owner",
    repo: "repo",
    org: "org",
    concurrency: 2,
    fetch: fetchImplementation,
  });
}

describe("RequestQueue", () => {
  it("runs queued tasks in FIFO start order", async () => {
    const queue = new RequestQueue(1);
    const starts: number[] = [];
    let releaseFirst!: () => void;

    const first = queue.enqueue(async () => {
      starts.push(1);
      await new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      return "first";
    });

    const second = queue.enqueue(async () => {
      starts.push(2);
      return "second";
    });

    const third = queue.enqueue(async () => {
      starts.push(3);
      return "third";
    });

    expect(starts).toEqual([1]);
    releaseFirst();

    await expect(Promise.all([first, second, third])).resolves.toEqual(["first", "second", "third"]);
    expect(starts).toEqual([1, 2, 3]);
  });
});

describe("GitHubRestClient", () => {
  it("paginates open pull requests until the final short page", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({ number: index + 1 }));
    const secondPage = [{ number: 101 }, { number: 102 }];
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(firstPage), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(secondPage), { status: 200 }));

    const client = createClient(fetchImplementation);
    const result = await client.listOpenPullRequests();

    expect(result).toHaveLength(102);
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
    expect(fetchImplementation.mock.calls[0]?.[0]).toContain("page=1");
    expect(fetchImplementation.mock.calls[1]?.[0]).toContain("page=2");
  });

  it("returns cached response body on 304", async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ number: 1 }), {
          status: 200,
          headers: { etag: '"v1"' },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 304 }));

    const client = createClient(fetchImplementation);

    await expect(client.getPullRequest(1)).resolves.toEqual({ number: 1 });
    await expect(client.getPullRequest(1)).resolves.toEqual({ number: 1 });
    expect(fetchImplementation.mock.calls[1]?.[1]).toMatchObject({
      headers: expect.any(Headers),
    });
    expect((fetchImplementation.mock.calls[1]?.[1]?.headers as Headers).get("If-None-Match")).toBe('"v1"');
  });

  it("fails fast when GitHub returns 304 without cached body", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 304 }));
    const client = createClient(fetchImplementation);

    await expect(client.getPullRequest(1)).rejects.toThrow(
      "GitHub returned 304 without cached response body for https://api.github.com/repos/owner/repo/pulls/1",
    );
  });

  it("throws GitHubApiError on non-2xx responses", async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ message: "Not Found" }), { status: 404 }));

    const client = createClient(fetchImplementation);

    await expect(client.getPullRequest(1)).rejects.toMatchObject({
      name: "GitHubApiError",
      status: 404,
      message: "Not Found",
    } satisfies Partial<GitHubApiError>);
  });

  it("extracts retryAt and rateLimit for rate-limited responses", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-12T10:00:00.000Z"));

    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ message: "API rate limit exceeded" }), {
        status: 429,
        headers: {
          "retry-after": "120",
          "x-ratelimit-limit": "5000",
          "x-ratelimit-remaining": "0",
          "x-ratelimit-reset": "1778571000",
        },
      }),
    );

    const client = createClient(fetchImplementation);

    await expect(client.getPullRequest(1)).rejects.toMatchObject({
      status: 429,
      retryAt: "2026-05-12T10:02:00.000Z",
      rateLimit: {
        limit: 5000,
        remaining: 0,
        resetAt: new Date(1778571000 * 1000).toISOString(),
      },
    });

    vi.useRealTimers();
  });

  it("returns external membership on 404 and caches membership lookups", async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ message: "Not Found" }), { status: 404 }));

    const client = createClient(fetchImplementation);

    await expect(client.getMembership("alice")).resolves.toEqual({ login: "alice", isInternal: false });
    await expect(client.getMembership("alice")).resolves.toEqual({ login: "alice", isInternal: false });
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });
});
