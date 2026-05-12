import { NextResponse } from "next/server";
import { ConfigError, getServerConfig, type ServerConfig } from "@/src/config";
import { GitHubApiError, GitHubRestClient } from "@/src/github/client";
import { buildKanbanResponse, type KanbanClient } from "@/src/kanban/build-board";
import type { ErrorResponse, KanbanResponse } from "@/src/kanban/types";

type HandlerDependencies = {
  getConfig?: () => ServerConfig;
  createClient?: (config: ServerConfig) => KanbanClient;
};

export function createKanbanHandler(dependencies: HandlerDependencies = {}) {
  const readConfig = dependencies.getConfig ?? getServerConfig;
  const createClient = dependencies.createClient ?? createDefaultClient;

  return async function GET(): Promise<NextResponse<KanbanResponse | ErrorResponse>> {
    try {
      const config = readConfig();
      const client = createClient(config);
      return NextResponse.json(await buildKanbanResponse(client));
    } catch (error) {
      if (error instanceof ConfigError) {
        return NextResponse.json({ error: "Configuration error", detail: error.message }, { status: 500 });
      }

      if (error instanceof GitHubApiError) {
        return NextResponse.json(
          { error: "GitHub API error", detail: error.message, retryAt: error.retryAt },
          { status: 502 },
        );
      }

      throw error;
    }
  };
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

export const GET = createKanbanHandler();
