export type ServerConfig = {
  githubToken: string;
  githubOwner: string;
  githubRepo: string;
  githubOrg: string;
  githubRequestConcurrency: number;
};

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

type Env = Partial<Record<string, string | undefined>>;
type RequiredEnvKey = "GITHUB_TOKEN" | "GITHUB_OWNER" | "GITHUB_REPO" | "GITHUB_ORG";

function readRequiredEnv(env: Env, key: RequiredEnvKey): string {
  const value = env[key]?.trim();

  if (!value) {
    throw new ConfigError(`Missing required environment variable: ${key}`);
  }

  return value;
}

function readConcurrency(env: Env): number {
  const rawValue = env.GITHUB_REQUEST_CONCURRENCY?.trim();

  if (!rawValue) {
    return 1;
  }

  const value = Number(rawValue);

  if (!Number.isInteger(value) || value < 1) {
    throw new ConfigError("GITHUB_REQUEST_CONCURRENCY must be a positive integer");
  }

  return value;
}

export function getServerConfig(env: Env = process.env): ServerConfig {
  return {
    githubToken: readRequiredEnv(env, "GITHUB_TOKEN"),
    githubOwner: readRequiredEnv(env, "GITHUB_OWNER"),
    githubRepo: readRequiredEnv(env, "GITHUB_REPO"),
    githubOrg: readRequiredEnv(env, "GITHUB_ORG"),
    githubRequestConcurrency: readConcurrency(env),
  };
}
