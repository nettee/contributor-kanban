import type { GitHubCheckRun, GitHubPullRequest, GitHubReview, GitHubStatus } from "@/src/github/types";
import type { KanbanColumnId } from "./types";

export type ClassificationInput = {
  pullRequest: GitHubPullRequest;
  reviews: GitHubReview[];
  checkRuns: GitHubCheckRun[];
  statuses: GitHubStatus[];
};

export type Classification = {
  column: KanbanColumnId;
  detailStatus: string;
};

const FAILURE_CHECK_CONCLUSIONS = new Set(["action_required", "cancelled", "failure", "startup_failure", "timed_out"]);
const FAILURE_STATUS_STATES = new Set(["error", "failure"]);

export function classifyPullRequest(input: ClassificationInput): Classification {
  if (input.pullRequest.draft) {
    return { column: "A", detailStatus: "Draft" };
  }

  const failingChecks = countFailingChecks(input.checkRuns, input.statuses);
  if (input.pullRequest.mergeable === false) {
    return { column: "B", detailStatus: "存在代码冲突" };
  }

  if (failingChecks > 0) {
    return { column: "B", detailStatus: `CI 未通过（${failingChecks} 项）` };
  }

  if (hasActiveChangeRequest(input.reviews)) {
    return { column: "C", detailStatus: "CHANGE_REQUESTED" };
  }

  if (input.pullRequest.mergeable === null) {
    return { column: "D", detailStatus: "合并状态计算中" };
  }

  if (hasApproval(input.reviews) && input.pullRequest.mergeable === true) {
    return { column: "E", detailStatus: "评审通过" };
  }

  return { column: "D", detailStatus: "处理中" };
}

function countFailingChecks(checkRuns: GitHubCheckRun[], statuses: GitHubStatus[]): number {
  const failedCheckRuns = checkRuns.filter((checkRun) =>
    checkRun.conclusion ? FAILURE_CHECK_CONCLUSIONS.has(checkRun.conclusion) : false,
  ).length;
  const latestStatuses = new Map<string, GitHubStatus>();

  for (const status of statuses) {
    const previous = latestStatuses.get(status.context);
    if (!previous || new Date(status.updated_at).getTime() > new Date(previous.updated_at).getTime()) {
      latestStatuses.set(status.context, status);
    }
  }

  const failedStatuses = Array.from(latestStatuses.values()).filter((status) => FAILURE_STATUS_STATES.has(status.state))
    .length;
  return failedCheckRuns + failedStatuses;
}

function hasActiveChangeRequest(reviews: GitHubReview[]): boolean {
  return Array.from(latestMeaningfulReviewsByUser(reviews).values()).some((review) => review.state === "CHANGES_REQUESTED");
}

function hasApproval(reviews: GitHubReview[]): boolean {
  return Array.from(latestMeaningfulReviewsByUser(reviews).values()).some((review) => review.state === "APPROVED");
}

function latestMeaningfulReviewsByUser(reviews: GitHubReview[]): Map<string, GitHubReview> {
  const latestReviews = new Map<string, GitHubReview>();

  for (const review of reviews) {
    if (!review.user || !review.submitted_at || !["APPROVED", "CHANGES_REQUESTED"].includes(review.state)) {
      continue;
    }

    const previous = latestReviews.get(review.user.login);
    if (!previous || new Date(review.submitted_at).getTime() > new Date(previous.submitted_at ?? 0).getTime()) {
      latestReviews.set(review.user.login, review);
    }
  }

  return latestReviews;
}
