import { GitHubRestClient } from "@/src/github/client";
import type {
  GitHubCheckRun,
  GitHubCommit,
  GitHubIssueComment,
  GitHubPullRequest,
  GitHubPullRequestListItem,
  GitHubReview,
  GitHubStatus,
} from "@/src/github/types";
import { classifyPullRequest } from "./classifier";
import { KANBAN_COLUMNS, type KanbanColumn, type KanbanResponse, type PullRequestCard } from "./types";

export type KanbanClient = Pick<
  GitHubRestClient,
  | "listOpenPullRequests"
  | "getPullRequest"
  | "listPullRequestReviews"
  | "listPullRequestCommits"
  | "listIssueComments"
  | "listCheckRuns"
  | "listCommitStatuses"
  | "getMembership"
>;

type PullRequestDetails = {
  listItem: GitHubPullRequestListItem;
  pullRequest: GitHubPullRequest;
  reviews: GitHubReview[];
  commits: GitHubCommit[];
  comments: GitHubIssueComment[];
  checkRuns: GitHubCheckRun[];
  statuses: GitHubStatus[];
  isInternal: boolean;
};

export async function buildKanbanResponse(client: KanbanClient, refreshedAt = new Date().toISOString()): Promise<KanbanResponse> {
  const pullRequests = await client.listOpenPullRequests();
  const cards = await Promise.all(pullRequests.map((listItem) => buildCard(client, listItem)));

  return {
    refreshedAt,
    columns: buildColumns(cards),
  };
}

export async function buildKanbanSummaryResponse(
  client: Pick<KanbanClient, "listOpenPullRequests">,
  refreshedAt = new Date().toISOString(),
): Promise<KanbanResponse> {
  const pullRequests = await client.listOpenPullRequests();
  const cards = pullRequests.map(buildSummaryCard);

  return {
    refreshedAt,
    columns: buildColumns(cards),
  };
}

function buildColumns(cards: PullRequestCard[]): KanbanColumn[] {
  return KANBAN_COLUMNS.map((column) => ({
    ...column,
    cards: cards
      .filter((card) => card.column === column.id)
      .sort((left, right) => new Date(right.activityAt).getTime() - new Date(left.activityAt).getTime()),
  }));
}

async function buildCard(client: KanbanClient, listItem: GitHubPullRequestListItem): Promise<PullRequestCard> {
  const [pullRequest, reviews, commits, comments, checkRunsResponse, statuses, membership] = await Promise.all([
    client.getPullRequest(listItem.number),
    client.listPullRequestReviews(listItem.number),
    client.listPullRequestCommits(listItem.number),
    client.listIssueComments(listItem.number),
    client.listCheckRuns(listItem.head.sha),
    client.listCommitStatuses(listItem.head.sha),
    client.getMembership(listItem.user.login),
  ]);

  return buildPullRequestCard({
    listItem,
    pullRequest,
    reviews,
    commits,
    comments,
    checkRuns: checkRunsResponse.check_runs,
    statuses,
    isInternal: membership.isInternal,
  });
}

function buildSummaryCard(listItem: GitHubPullRequestListItem): PullRequestCard {
  return {
    number: listItem.number,
    title: listItem.title,
    url: listItem.html_url,
    author: { login: listItem.user.login, isInternal: isInternalAssociation(listItem.author_association) },
    detailStatus: listItem.draft ? "Draft" : "等待详细状态刷新",
    activityAt: listItem.updated_at,
    updatedAt: listItem.updated_at,
    column: listItem.draft ? "A" : "D",
  };
}

function isInternalAssociation(authorAssociation: string | undefined): boolean {
  return authorAssociation === "MEMBER" || authorAssociation === "OWNER" || authorAssociation === "COLLABORATOR";
}

export function buildPullRequestCard(details: PullRequestDetails): PullRequestCard {
  const classification = classifyPullRequest({
    pullRequest: details.pullRequest,
    reviews: details.reviews,
    checkRuns: details.checkRuns,
    statuses: details.statuses,
  });

  return {
    number: details.pullRequest.number,
    title: details.pullRequest.title,
    url: details.pullRequest.html_url,
    author: { login: details.pullRequest.user.login, isInternal: details.isInternal },
    detailStatus: classification.detailStatus,
    activityAt: readActivityAt(details),
    updatedAt: details.pullRequest.updated_at,
    column: classification.column,
  };
}

function readActivityAt(details: PullRequestDetails): string {
  const authorLogin = details.pullRequest.user.login;
  const timestamps = [
    details.pullRequest.updated_at,
    ...details.commits
      .filter((commit) => commit.author?.login === authorLogin)
      .map((commit) => commit.commit.author?.date)
      .filter(isPresent),
    ...details.comments
      .filter((comment) => comment.user.login === authorLogin)
      .map((comment) => comment.updated_at),
    ...details.reviews
      .filter((review) => review.user?.login === authorLogin)
      .map((review) => review.submitted_at)
      .filter(isPresent),
  ];

  return timestamps.reduce((latest, value) =>
    new Date(value).getTime() > new Date(latest).getTime() ? value : latest,
  );
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
