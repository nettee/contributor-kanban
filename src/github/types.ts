export type GitHubUser = {
  login: string;
};

export type GitHubPullRequestListItem = {
  number: number;
  title: string;
  state: string;
  draft: boolean;
  updated_at: string;
  created_at: string;
  html_url: string;
  user: GitHubUser;
  head: {
    sha: string;
    ref: string;
  };
  base: {
    ref: string;
  };
};

export type GitHubPullRequest = GitHubPullRequestListItem & {
  body: string | null;
  mergeable: boolean | null;
  mergeable_state: string;
};

export type GitHubReview = {
  id: number;
  state: string;
  submitted_at: string | null;
  user: GitHubUser | null;
};

export type GitHubCommit = {
  sha: string;
  commit: {
    author: {
      date: string;
      name: string;
      email: string;
    } | null;
    message: string;
  };
  author: GitHubUser | null;
};

export type GitHubIssueComment = {
  id: number;
  created_at: string;
  updated_at: string;
  user: GitHubUser;
  body: string;
};

export type GitHubCheckRun = {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  html_url: string | null;
};

export type GitHubCheckRunsResponse = {
  total_count: number;
  check_runs: GitHubCheckRun[];
};

export type GitHubStatus = {
  id: number;
  state: string;
  context: string;
  description: string | null;
  target_url: string | null;
  updated_at: string;
};

export type GitHubRateLimit = {
  limit?: number;
  remaining?: number;
  resetAt?: string;
};

export type GitHubOrgMembership = {
  login: string;
  isInternal: boolean;
};
