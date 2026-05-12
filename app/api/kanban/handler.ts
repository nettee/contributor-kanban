import { NextResponse } from "next/server";
import { revalidateTag, unstable_cache } from "next/cache";
import { ConfigError, getServerConfig, type ServerConfig } from "@/src/config";
import { GitHubAppAuth } from "@/src/github/app-auth";
import { GitHubApiError, GitHubRestClient } from "@/src/github/client";
import { buildKanbanResponse, buildKanbanSummaryResponse, type KanbanClient } from "@/src/kanban/build-board";
import type { ErrorResponse, KanbanResponse } from "@/src/kanban/types";
import { getCached, setCached } from "@/src/server/cache";

const KANBAN_CACHE_TTL_MS = 60 * 60_000;
const BROWSER_CACHE_SECONDS = KANBAN_CACHE_TTL_MS / 1000;
const KANBAN_DETAILS_DATA_CACHE_TAG = "kanban-response:details";
const KANBAN_SUMMARY_DATA_CACHE_TAG = "kanban-response:summary";

let defaultAuthCache:
  | {
      key: string;
      auth: GitHubAppAuth;
    }
  | undefined;

type HandlerDependencies = {
  getConfig?: () => ServerConfig;
  createClient?: (config: ServerConfig) => KanbanClient | Promise<KanbanClient>;
};

const getDataCachedDefaultKanbanDetailsResponse = unstable_cache(
  async (cacheScope: string): Promise<KanbanResponse> => {
    void cacheScope;
    const config = getServerConfig();

    return buildKanbanResponseForConfig(config, createDefaultClient, false);
  },
  ["kanban-response", "details"],
  {
    revalidate: BROWSER_CACHE_SECONDS,
    tags: [KANBAN_DETAILS_DATA_CACHE_TAG],
  },
);

const getDataCachedDefaultKanbanSummaryResponse = unstable_cache(
  async (cacheScope: string): Promise<KanbanResponse> => {
    void cacheScope;
    const config = getServerConfig();

    return buildKanbanResponseForConfig(config, createDefaultClient, true);
  },
  ["kanban-response", "summary"],
  {
    revalidate: BROWSER_CACHE_SECONDS,
    tags: [KANBAN_SUMMARY_DATA_CACHE_TAG],
  },
);

export function createKanbanHandler(dependencies: HandlerDependencies = {}) {
  const readConfig = dependencies.getConfig ?? getServerConfig;
  const createClient = dependencies.createClient ?? createDefaultClient;
  const canUseDataCache = !dependencies.getConfig && !dependencies.createClient;

  return async function GET(request: Request): Promise<NextResponse<KanbanResponse | ErrorResponse>> {
    try {
      const config = readConfig();
      if (!dependencies.createClient) {
        getDefaultAuth(config);
      }

      const searchParams = new URL(request.url).searchParams;
      const isSummaryRequest = searchParams.get("summary") === "1";
      const shouldRefresh = searchParams.get("refresh") === "1";

      if (canUseDataCache) {
        const cacheScope = createKanbanCacheScope(config);

        if (shouldRefresh) {
          revalidateTag(createKanbanDataCacheTag(isSummaryRequest));
          const response = isSummaryRequest
            ? await getDataCachedDefaultKanbanSummaryResponse(cacheScope)
            : await getDataCachedDefaultKanbanDetailsResponse(cacheScope);

          return createKanbanResponse(response, true);
        }

        const response = isSummaryRequest
          ? await getDataCachedDefaultKanbanSummaryResponse(cacheScope)
          : await getDataCachedDefaultKanbanDetailsResponse(cacheScope);

        return createKanbanResponse(response, false);
      }

      const cacheKey = createKanbanCacheKey(config, isSummaryRequest);
      const cached = shouldRefresh ? undefined : getCached<KanbanResponse>(cacheKey);

      if (cached) {
        return createKanbanResponse(cached, false);
      }

      const response = await buildKanbanResponseForConfig(config, createClient, isSummaryRequest);
      setCached(cacheKey, response, KANBAN_CACHE_TTL_MS);

      return createKanbanResponse(response, shouldRefresh);
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

function createKanbanCacheScope(config: ServerConfig): string {
  return [config.githubOwner, config.githubRepo, config.githubOrg, config.githubAppId, config.githubAppInstallationId].join(":");
}

function createKanbanDataCacheTag(isSummaryRequest: boolean): string {
  return isSummaryRequest ? KANBAN_SUMMARY_DATA_CACHE_TAG : KANBAN_DETAILS_DATA_CACHE_TAG;
}

async function buildKanbanResponseForConfig(
  config: ServerConfig,
  createClient: (config: ServerConfig) => KanbanClient | Promise<KanbanClient>,
  isSummaryRequest: boolean,
): Promise<KanbanResponse> {
  const client = await createClient(config);
  const repository = `${config.githubOwner}/${config.githubRepo}`;

  return isSummaryRequest ? buildKanbanSummaryResponse(client, repository) : buildKanbanResponse(client, repository);
}

function createKanbanResponse(response: KanbanResponse, shouldRefresh: boolean): NextResponse<KanbanResponse> {
  return NextResponse.json(response, {
    headers: {
      "Cache-Control": shouldRefresh ? "no-store" : `private, max-age=${BROWSER_CACHE_SECONDS}`,
    },
  });
}

function createKanbanCacheKey(config: ServerConfig, isSummaryRequest: boolean): string {
  const mode = isSummaryRequest ? "summary" : "details";
  return `kanban:${config.githubOwner}/${config.githubRepo}:${mode}`;
}

async function createDefaultClient(config: ServerConfig): Promise<KanbanClient> {
  const token = await getDefaultAuth(config).getInstallationToken();

  return new GitHubRestClient({
    token,
    owner: config.githubOwner,
    repo: config.githubRepo,
    org: config.githubOrg,
    concurrency: config.githubRequestConcurrency,
  });
}

function getDefaultAuth(config: ServerConfig): GitHubAppAuth {
  const key = `${config.githubAppId}:${config.githubAppInstallationId}`;

  if (defaultAuthCache?.key === key) {
    return defaultAuthCache.auth;
  }

  const auth = new GitHubAppAuth({
    appId: config.githubAppId,
    installationId: config.githubAppInstallationId,
    privateKeyBase64: config.githubAppPrivateKeyBase64,
  });
  defaultAuthCache = { key, auth };
  return auth;
}
