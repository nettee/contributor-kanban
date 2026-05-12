import { NextResponse } from "next/server";
import { ConfigError, getServerConfig, type ServerConfig } from "@/src/config";
import { GitHubApiError, GitHubRestClient } from "@/src/github/client";
import { buildKanbanResponse, buildKanbanSummaryResponse, type KanbanClient } from "@/src/kanban/build-board";
import type { ErrorResponse, KanbanResponse } from "@/src/kanban/types";
import { getCached, setCached } from "@/src/server/cache";

const KANBAN_CACHE_TTL_MS = 60_000;

type HandlerDependencies = {
  getConfig?: () => ServerConfig;
  createClient?: (config: ServerConfig) => KanbanClient;
};

export function createKanbanHandler(dependencies: HandlerDependencies = {}) {
  const readConfig = dependencies.getConfig ?? getServerConfig;
  const createClient = dependencies.createClient ?? createDefaultClient;

  return async function GET(request: Request): Promise<NextResponse<KanbanResponse | ErrorResponse>> {
    try {
      const config = readConfig();
      const client = createClient(config);
      const isSummaryRequest = new URL(request.url).searchParams.get("summary") === "1";
      const cacheKey = createKanbanCacheKey(config, isSummaryRequest);
      const cached = getCached<KanbanResponse>(cacheKey);

      if (cached) {
        return NextResponse.json(cached);
      }

      const response = isSummaryRequest ? await buildKanbanSummaryResponse(client) : await buildKanbanResponse(client);
      setCached(cacheKey, response, KANBAN_CACHE_TTL_MS);

      return NextResponse.json(response);
    } catch (error) {
      if (error instanceof ConfigError) {
        return NextResponse.json({ error: "Configuration error", detail: error.message }, { status: 500 });
      }

      if (error instanceof GitHubApiError) {
        return NextResponse.json(
          { error: "GitHub API error", detail: error.message, retryAt: error.retryAt, rateLimit: error.rateLimit },
          { status: error.status === 504 ? 504 : 502 },
        );
      }

      throw error;
    }
  };
}

function createKanbanCacheKey(config: ServerConfig, isSummaryRequest: boolean): string {
  const mode = isSummaryRequest ? "summary" : "details";
  return `kanban:${config.githubOwner}/${config.githubRepo}:${mode}`;
}

function createDefaultClient(config: ServerConfig): KanbanClient {
  return new GitHubRestClient({
    token: config.githubToken,
    owner: config.githubOwner,
    repo: config.githubRepo,
    org: config.githubOrg,
    concurrency: config.githubRequestConcurrency,
  });
}
