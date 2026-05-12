import { describe, expect, it } from "vitest";
import type { GitHubPullRequest, GitHubReview } from "@/src/github/types";
import { classifyPullRequest } from "./classifier";

function pullRequest(overrides: Partial<GitHubPullRequest> = {}): GitHubPullRequest {
  return {
    number: 1,
    title: "PR",
    state: "open",
    draft: false,
    updated_at: "2026-05-12T10:00:00.000Z",
    created_at: "2026-05-12T09:00:00.000Z",
    html_url: "https://github.com/owner/repo/pull/1",
    user: { login: "alice" },
    head: { sha: "head-sha", ref: "feature" },
    base: { ref: "main" },
    body: null,
    mergeable: true,
    mergeable_state: "clean",
    ...overrides,
  };
}

function review(state: string, submittedAt: string, login = "reviewer"): GitHubReview {
  return { id: Date.parse(submittedAt), state, submitted_at: submittedAt, user: { login } };
}

describe("classifyPullRequest", () => {
  it("applies Draft before every other rule", () => {
    expect(
      classifyPullRequest({
        pullRequest: pullRequest({ draft: true, mergeable: false }),
        reviews: [review("CHANGES_REQUESTED", "2026-05-12T10:00:00.000Z")],
        checkRuns: [{ id: 1, name: "ci", status: "completed", conclusion: "failure", html_url: null }],
        statuses: [],
      }),
    ).toEqual({ column: "A", detailStatus: "Draft" });
  });

  it("classifies conflicts and failing CI as not mergeable before review state", () => {
    expect(
      classifyPullRequest({
        pullRequest: pullRequest({ mergeable: false }),
        reviews: [review("CHANGES_REQUESTED", "2026-05-12T10:00:00.000Z")],
        checkRuns: [],
        statuses: [],
      }).column,
    ).toBe("B");

    expect(
      classifyPullRequest({
        pullRequest: pullRequest(),
        reviews: [review("APPROVED", "2026-05-12T10:00:00.000Z")],
        checkRuns: [{ id: 1, name: "ci", status: "completed", conclusion: "failure", html_url: null }],
        statuses: [{ id: 1, state: "success", context: "lint", description: null, target_url: null, updated_at: "2026-05-12T10:00:00.000Z" }],
      }),
    ).toEqual({ column: "B", detailStatus: "CI 未通过（1 项）" });
  });

  it("uses latest meaningful review per reviewer for change requests", () => {
    expect(
      classifyPullRequest({
        pullRequest: pullRequest(),
        reviews: [
          review("CHANGES_REQUESTED", "2026-05-12T10:00:00.000Z"),
          review("APPROVED", "2026-05-12T11:00:00.000Z"),
        ],
        checkRuns: [],
        statuses: [],
      }),
    ).toEqual({ column: "E", detailStatus: "评审通过" });
  });

  it("classifies active change requests and pending mergeability", () => {
    expect(
      classifyPullRequest({
        pullRequest: pullRequest(),
        reviews: [review("CHANGES_REQUESTED", "2026-05-12T10:00:00.000Z")],
        checkRuns: [],
        statuses: [],
      }),
    ).toEqual({ column: "C", detailStatus: "CHANGE_REQUESTED" });

    expect(
      classifyPullRequest({
        pullRequest: pullRequest({ mergeable: null }),
        reviews: [],
        checkRuns: [],
        statuses: [],
      }),
    ).toEqual({ column: "D", detailStatus: "合并状态计算中" });
  });

  it("falls back to in progress", () => {
    expect(
      classifyPullRequest({
        pullRequest: pullRequest(),
        reviews: [],
        checkRuns: [],
        statuses: [],
      }),
    ).toEqual({ column: "D", detailStatus: "处理中" });
  });
});
