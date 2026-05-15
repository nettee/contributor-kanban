import { beforeEach, describe, expect, it } from "vitest";
import type { AnalysisStore } from "@/src/analysis/store";
import type { AnalysisSnapshot } from "@/src/analysis/types";
import { createAnalysisGetHandler, createAnalysisPostHandler } from "./handler";

const FIXED_NOW = new Date("2026-05-14T01:00:00.000Z");

function createInMemoryStore(initial: AnalysisSnapshot | null = null): AnalysisStore {
  let current: AnalysisSnapshot | null = initial;
  return {
    async getLatest() {
      return current;
    },
    async saveLatest(snapshot) {
      current = snapshot;
    },
  };
}

function validSnapshotPayload(): Record<string, unknown> {
  return {
    generatedAt: "2026-05-14T01:00:00.000Z",
    generatedBy: "claude-code@mini",
    summary: "今日待接手 PR 评估",
    priorityRecommendations: [{ prNumber: 1094, reason: "高价值 bug fix，改动小" }],
    items: [
      {
        prNumber: 1094,
        title: "fix: deck PDF export shows all slides, not just current page",
        url: "https://github.com/nexu-io/open-design/pull/1094",
        score: 90,
        bucket: "priority",
        draft: false,
        firstTimeContributor: false,
        awaitingHours: 94,
        conclusion: "高价值 bug fix，范围很小，用户影响直接，容易 salvage 并合并。",
      },
    ],
  };
}

function buildPostRequest(body: unknown, options: { token?: string | null } = {}): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.token !== null) {
    headers.Authorization = `Bearer ${options.token ?? "test-token"}`;
  }

  return new Request("http://localhost/api/analysis", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("GET /api/analysis", () => {
  it("returns { snapshot: null } when no analysis is stored", async () => {
    const handler = createAnalysisGetHandler({
      getEnv: () => ({}),
      getStore: () => createInMemoryStore(null),
    });

    const response = await handler();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ snapshot: null });
  });

  it("returns the latest snapshot when one exists", async () => {
    const snapshot: AnalysisSnapshot = {
      generatedAt: "2026-05-14T01:00:00.000Z",
      generatedBy: "claude-code@mini",
      priorityRecommendations: [],
      items: [],
    };

    const handler = createAnalysisGetHandler({
      getEnv: () => ({}),
      getStore: () => createInMemoryStore(snapshot),
    });

    const response = await handler();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ snapshot });
  });

  it("returns 502 when the store throws", async () => {
    const handler = createAnalysisGetHandler({
      getEnv: () => ({}),
      getStore: () => ({
        async getLatest() {
          throw new Error("KV down");
        },
        async saveLatest() {},
      }),
    });

    const response = await handler();
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error).toBe("Analysis storage error");
    expect(body.detail).toBe("KV down");
  });
});

describe("POST /api/analysis", () => {
  let store: AnalysisStore;

  beforeEach(() => {
    store = createInMemoryStore(null);
  });

  function makeHandler(envOverrides: Record<string, string | undefined> = {}) {
    return createAnalysisPostHandler({
      getEnv: () => ({ ANALYSIS_WRITE_TOKEN: "test-token", ...envOverrides }),
      getStore: () => store,
      now: () => FIXED_NOW,
    });
  }

  it("returns 503 when ANALYSIS_WRITE_TOKEN is not configured", async () => {
    const handler = makeHandler({ ANALYSIS_WRITE_TOKEN: undefined });

    const response = await handler(buildPostRequest(validSnapshotPayload()));

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error).toBe("Analysis writes are disabled");
  });

  it("returns 401 when Authorization header is missing", async () => {
    const handler = makeHandler();

    const response = await handler(buildPostRequest(validSnapshotPayload(), { token: null }));

    expect(response.status).toBe(401);
  });

  it("returns 401 when the bearer token does not match", async () => {
    const handler = makeHandler();

    const response = await handler(buildPostRequest(validSnapshotPayload(), { token: "wrong" }));

    expect(response.status).toBe(401);
  });

  it("returns 400 when the body is not valid JSON", async () => {
    const handler = makeHandler();

    const response = await handler(buildPostRequest("not-json"));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid JSON body");
  });

  it("returns 400 when items is empty", async () => {
    const handler = makeHandler();
    const payload = validSnapshotPayload();
    payload.items = [];

    const response = await handler(buildPostRequest(payload));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid payload");
    expect(body.detail).toMatch(/items/);
  });

  it("rejects bucket values outside the allowed set", async () => {
    const handler = makeHandler();
    const payload = validSnapshotPayload();
    (payload.items as Array<Record<string, unknown>>)[0].bucket = "high";

    const response = await handler(buildPostRequest(payload));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.detail).toMatch(/bucket/);
  });

  it("rejects scores outside [0, 100]", async () => {
    const handler = makeHandler();
    const payload = validSnapshotPayload();
    (payload.items as Array<Record<string, unknown>>)[0].score = 150;

    const response = await handler(buildPostRequest(payload));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.detail).toMatch(/score/);
  });

  it("rejects priorityRecommendations that reference unknown PR numbers", async () => {
    const handler = makeHandler();
    const payload = validSnapshotPayload();
    payload.priorityRecommendations = [{ prNumber: 9999, reason: "ghost" }];

    const response = await handler(buildPostRequest(payload));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.detail).toMatch(/9999/);
  });

  it("rejects duplicate items.prNumber", async () => {
    const handler = makeHandler();
    const payload = validSnapshotPayload();
    const items = payload.items as Array<Record<string, unknown>>;
    payload.items = [items[0], { ...items[0] }];

    const response = await handler(buildPostRequest(payload));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.detail).toMatch(/duplicate/);
  });

  it("stores a valid snapshot and echoes it back", async () => {
    const handler = makeHandler();

    const response = await handler(buildPostRequest(validSnapshotPayload()));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.snapshot.items).toHaveLength(1);
    expect(body.snapshot.items[0].prNumber).toBe(1094);
    expect(body.snapshot.priorityRecommendations[0].prNumber).toBe(1094);
    expect(await store.getLatest()).toEqual(body.snapshot);
  });

  it("falls back to now() when generatedAt is omitted", async () => {
    const handler = makeHandler();
    const payload = validSnapshotPayload();
    delete payload.generatedAt;

    const response = await handler(buildPostRequest(payload));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.snapshot.generatedAt).toBe(FIXED_NOW.toISOString());
  });

  it("returns 502 when the store fails to persist", async () => {
    const failingStore: AnalysisStore = {
      async getLatest() {
        return null;
      },
      async saveLatest() {
        throw new Error("KV unavailable");
      },
    };
    const handler = createAnalysisPostHandler({
      getEnv: () => ({ ANALYSIS_WRITE_TOKEN: "test-token" }),
      getStore: () => failingStore,
      now: () => FIXED_NOW,
    });

    const response = await handler(buildPostRequest(validSnapshotPayload()));

    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error).toBe("Analysis storage error");
    expect(body.detail).toBe("KV unavailable");
  });
});
