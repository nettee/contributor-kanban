import { RequestQueue } from "./queue";
import type {
  GitHubCheckRunsResponse,
  GitHubCommit,
  GitHubIssueComment,
  GitHubOrgMembership,
  GitHubOrgMembershipResponse,
  GitHubPullRequest,
  GitHubPullRequestListItem,
  GitHubRateLimit,
  GitHubReview,
  GitHubStatus,
} from "./types";

const GITHUB_API_URL = "https://api.github.com";
const GITHUB_API_VERSION = "2022-11-28";
const GITHUB_REQUEST_TIMEOUT_MS = 15_000;

type FetchImplementation = typeof fetch;

type CacheEntry = {
  body: unknown;
  etag?: string;
  lastModified?: string;
};

type RequestOptions = {
  method?: string;
};

export class GitHubApiError extends Error {
  readonly status: number;
  readonly retryAt?: string;
  readonly rateLimit?: GitHubRateLimit;

  constructor(options: { status: number; message: string; retryAt?: string; rateLimit?: GitHubRateLimit }) {
    super(options.message);
    this.name = "GitHubApiError";
    this.status = options.status;
    this.retryAt = options.retryAt;
    this.rateLimit = options.rateLimit;
  }
}

export class GitHubRestClient {
  private readonly token: string;
  private readonly owner: string;
  private readonly repo: string;
  private readonly org: string;
  private readonly fetchImplementation: FetchImplementation;
  private readonly queue: RequestQueue;
  private readonly responseCache = new Map<string, CacheEntry>();
  private readonly membershipCache = new Map<string, Promise<GitHubOrgMembership>>();

  constructor(options: {
    token: string;
    owner: string;
    repo: string;
    org: string;
    concurrency: number;
    fetch?: FetchImplementation;
  }) {
    this.token = options.token;
    this.owner = options.owner;
    this.repo = options.repo;
    this.org = options.org;
    this.fetchImplementation = options.fetch ?? fetch;
    this.queue = new RequestQueue(options.concurrency);
  }

  async listOpenPullRequests(): Promise<GitHubPullRequestListItem[]> {
    const pullRequests: GitHubPullRequestListItem[] = [];
    let page = 1;

    while (true) {
      const response = await this.requestJson<GitHubPullRequestListItem[]>(
        `/repos/${this.owner}/${this.repo}/pulls?state=open&sort=updated&direction=desc&per_page=100&page=${page}`,
      );

      pullRequests.push(...response);

      if (response.length < 100) {
        return pullRequests;
      }

      page += 1;
    }
  }

  getPullRequest(number: number): Promise<GitHubPullRequest> {
    return this.requestJson(`/repos/${this.owner}/${this.repo}/pulls/${number}`);
  }

  async listPullRequestReviews(number: number): Promise<GitHubReview[]> {
    const reviews: GitHubReview[] = [];
    let page = 1;

    while (true) {
      const response = await this.requestJson<GitHubReview[]>(
        `/repos/${this.owner}/${this.repo}/pulls/${number}/reviews?per_page=100&page=${page}`,
      );

      reviews.push(...response);

      if (response.length < 100) {
        return reviews;
      }

      page += 1;
    }
  }

  listPullRequestCommits(number: number): Promise<GitHubCommit[]> {
    return this.requestJson(`/repos/${this.owner}/${this.repo}/pulls/${number}/commits`);
  }

  listIssueComments(number: number): Promise<GitHubIssueComment[]> {
    return this.requestJson(`/repos/${this.owner}/${this.repo}/issues/${number}/comments`);
  }

  async listCheckRuns(ref: string): Promise<GitHubCheckRunsResponse> {
    return this.requestJson(`/repos/${this.owner}/${this.repo}/commits/${ref}/check-runs`);
  }

  listCommitStatuses(ref: string): Promise<GitHubStatus[]> {
    return this.requestJson(`/repos/${this.owner}/${this.repo}/commits/${ref}/statuses`);
  }

  getMembership(username: string): Promise<GitHubOrgMembership> {
    const cached = this.membershipCache.get(username);

    if (cached) {
      return cached;
    }

    const request = this.requestMembership(username);
    this.membershipCache.set(username, request);
    return request;
  }

  private async requestMembership(username: string): Promise<GitHubOrgMembership> {
    return { login: username, isInternal: await this.isOrgMember(username) };
  }

  private async isOrgMember(username: string): Promise<boolean> {
    const response = await this.requestRaw(`/orgs/${this.org}/memberships/${username}`);

    if (response.status === 404) {
      return false;
    }

    if (!response.ok) {
      throw await this.buildApiError(response);
    }

    const membership = (await response.json()) as GitHubOrgMembershipResponse;
    return membership.state === "active";
  }

  private async requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = `${GITHUB_API_URL}${path}`;
    const cacheEntry = this.responseCache.get(url);
    const headers = this.createHeaders();

    if (cacheEntry?.etag) {
      headers.set("If-None-Match", cacheEntry.etag);
    }

    if (cacheEntry?.lastModified) {
      headers.set("If-Modified-Since", cacheEntry.lastModified);
    }

    const response = await this.requestRaw(path, { ...options, headers });

    if (response.status === 304) {
      if (!cacheEntry) {
        throw new Error(`GitHub returned 304 without cached response body for ${url}`);
      }

      return cacheEntry.body as T;
    }

    if (!response.ok) {
      throw await this.buildApiError(response);
    }

    const body = (await response.json()) as T;
    this.responseCache.set(url, {
      body,
      etag: response.headers.get("etag") ?? undefined,
      lastModified: response.headers.get("last-modified") ?? undefined,
    });
    return body;
  }

  private requestRaw(path: string, options: RequestOptions & { headers?: Headers } = {}): Promise<Response> {
    return this.queue.enqueue(() =>
      this.fetchWithTimeout(path, {
        method: options.method ?? "GET",
        headers: options.headers ?? this.createHeaders(),
      }),
    );
  }

  private async fetchWithTimeout(path: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, GITHUB_REQUEST_TIMEOUT_MS);

    try {
      return await this.fetchImplementation(`${GITHUB_API_URL}${path}`, {
        ...init,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new GitHubApiError({
          status: 504,
          message: `GitHub API request timed out after ${GITHUB_REQUEST_TIMEOUT_MS}ms: ${path}`,
        });
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private createHeaders(): Headers {
    return new Headers({
      Authorization: `Bearer ${this.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": GITHUB_API_VERSION,
    });
  }

  private async buildApiError(response: Response): Promise<GitHubApiError> {
    const bodyText = await response.text();
    const body = parseErrorBody(bodyText);
    const rateLimit = readRateLimit(response.headers);
    const retryAt = readRetryAt(response.status, response.headers);
    const message = body?.message || bodyText || `GitHub API request failed with status ${response.status}`;

    return new GitHubApiError({
      status: response.status,
      message,
      retryAt,
      rateLimit,
    });
  }
}

function parseErrorBody(bodyText: string): { message?: string } | null {
  if (!bodyText) {
    return null;
  }

  try {
    return JSON.parse(bodyText) as { message?: string };
  } catch {
    return null;
  }
}

function readRateLimit(headers: Headers): GitHubRateLimit | undefined {
  const limit = readNumberHeader(headers, "x-ratelimit-limit");
  const remaining = readNumberHeader(headers, "x-ratelimit-remaining");
  const resetSeconds = readNumberHeader(headers, "x-ratelimit-reset");

  if (limit === undefined && remaining === undefined && resetSeconds === undefined) {
    return undefined;
  }

  return {
    limit,
    remaining,
    resetAt: resetSeconds === undefined ? undefined : new Date(resetSeconds * 1000).toISOString(),
  };
}

function readRetryAt(status: number, headers: Headers): string | undefined {
  if (status !== 403 && status !== 429) {
    return undefined;
  }

  const retryAfter = readNumberHeader(headers, "retry-after");
  if (retryAfter !== undefined) {
    return new Date(Date.now() + retryAfter * 1000).toISOString();
  }

  const resetSeconds = readNumberHeader(headers, "x-ratelimit-reset");
  if (resetSeconds !== undefined) {
    return new Date(resetSeconds * 1000).toISOString();
  }

  return undefined;
}

function readNumberHeader(headers: Headers, key: string): number | undefined {
  const value = headers.get(key);

  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
