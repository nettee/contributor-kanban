export type ServerConfig = {
  githubAppId: string;
  githubAppInstallationId: string;
  githubAppPrivateKeyBase64: string;
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
type RequiredEnvKey =
  | "GITHUB_APP_ID"
  | "GITHUB_APP_INSTALLATION_ID"
  | "GITHUB_APP_PRIVATE_KEY_BASE64"
  | "GITHUB_OWNER"
  | "GITHUB_REPO"
  | "GITHUB_ORG";

function readRequiredEnv(env: Env, key: RequiredEnvKey): string {
  const value = env[key]?.trim();

  if (!value) {
    throw new ConfigError(`Missing required environment variable: ${key}`);
  }

  return value;
}

function readPositiveIntegerEnv(env: Env, key: "GITHUB_APP_ID" | "GITHUB_APP_INSTALLATION_ID"): string {
  const value = readRequiredEnv(env, key);

  if (!/^\d+$/.test(value) || Number(value) < 1) {
    throw new ConfigError(`${key} must be a positive integer`);
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
    githubAppId: readPositiveIntegerEnv(env, "GITHUB_APP_ID"),
    githubAppInstallationId: readPositiveIntegerEnv(env, "GITHUB_APP_INSTALLATION_ID"),
    githubAppPrivateKeyBase64: readRequiredEnv(env, "GITHUB_APP_PRIVATE_KEY_BASE64"),
    githubOwner: readRequiredEnv(env, "GITHUB_OWNER"),
    githubRepo: readRequiredEnv(env, "GITHUB_REPO"),
    githubOrg: readRequiredEnv(env, "GITHUB_ORG"),
    githubRequestConcurrency: readConcurrency(env),
  };
}
