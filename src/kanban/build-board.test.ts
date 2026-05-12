import { describe, expect, it, vi } from "vitest";
import type { KanbanClient } from "./build-board";
import { buildKanbanResponse } from "./build-board";

function createClient(): KanbanClient {
  return {
    listOpenPullRequests: vi.fn().mockResolvedValue([
      {
        number: 1,
        title: "Older",
        state: "open",
        draft: false,
        updated_at: "2026-05-12T08:00:00.000Z",
        created_at: "2026-05-12T07:00:00.000Z",
        html_url: "https://github.com/owner/repo/pull/1",
        author_association: "CONTRIBUTOR",
        user: { login: "alice" },
        head: { sha: "sha-1", ref: "one" },
        base: { ref: "main" },
      },
      {
        number: 2,
        title: "Newer",
        state: "open",
        draft: false,
        updated_at: "2026-05-12T09:00:00.000Z",
        created_at: "2026-05-12T07:00:00.000Z",
        html_url: "https://github.com/owner/repo/pull/2",
        author_association: "MEMBER",
        user: { login: "bob" },
        head: { sha: "sha-2", ref: "two" },
        base: { ref: "main" },
      },
    ]),
    getPullRequest: vi.fn(async (number: number) => ({
      number,
      title: number === 1 ? "Older" : "Newer",
      state: "open",
      draft: false,
      updated_at: number === 1 ? "2026-05-12T08:00:00.000Z" : "2026-05-12T09:00:00.000Z",
      created_at: "2026-05-12T07:00:00.000Z",
      html_url: `https://github.com/owner/repo/pull/${number}`,
      author_association: number === 1 ? "CONTRIBUTOR" : "MEMBER",
      user: { login: number === 1 ? "alice" : "bob" },
      head: { sha: `sha-${number}`, ref: String(number) },
      base: { ref: "main" },
      body: null,
      mergeable: true,
      mergeable_state: "clean",
    })),
    listPullRequestReviews: vi.fn().mockResolvedValue([{ id: 1, state: "APPROVED", submitted_at: "2026-05-12T10:00:00.000Z", user: { login: "reviewer" } }]),
    listPullRequestCommits: vi.fn(async (number: number) => [
      {
        sha: `sha-${number}`,
        commit: { author: { date: number === 1 ? "2026-05-12T11:00:00.000Z" : "2026-05-12T12:00:00.000Z", name: "Author", email: "a@example.com" }, message: "commit" },
        author: { login: number === 1 ? "alice" : "bob" },
      },
    ]),
    listIssueComments: vi.fn().mockResolvedValue([]),
    listCheckRuns: vi.fn().mockResolvedValue({ total_count: 0, check_runs: [] }),
    listCommitStatuses: vi.fn().mockResolvedValue([]),
    getMembership: vi.fn(async (login: string) => ({ login, isInternal: login === "alice" })),
  };
}

describe("buildKanbanResponse", () => {
  it("builds columns, contributor type, activityAt, and descending card order", async () => {
    const response = await buildKanbanResponse(createClient(), "owner/repo", "2026-05-12T13:00:00.000Z");
    const mergeable = response.columns.find((column) => column.id === "E");

    expect(response.repository).toBe("owner/repo");
    expect(response.refreshedAt).toBe("2026-05-12T13:00:00.000Z");
    expect(response.columns.map((column) => column.id)).toEqual(["A", "B", "C", "D", "E"]);
    expect(mergeable?.cards.map((card) => card.number)).toEqual([2, 1]);
    expect(mergeable?.cards[1]).toMatchObject({
      number: 1,
      author: { login: "alice", isInternal: true },
      activityAt: "2026-05-12T11:00:00.000Z",
      detailStatus: "评审通过",
      column: "E",
    });
    expect(mergeable?.cards[0]).toMatchObject({
      number: 2,
      author: { login: "bob", isInternal: true },
    });
  });
});
